import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { prepararSqlMigrationFiscal } from './lib/reconciliacao-migrations-fiscais.mjs';

// A execução deste utilitário está restrita ao ambiente local existente.
// Produção exige o ritual de implantação; este comando não a aceita.
const url = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55449'
  || !['/admin_brasilnfe_m11', '/teste_brasilnfe_m11_sintetico'].includes(url.pathname)) throw new Error('Somente bancos fiscais locais isolados conhecidos.');
const aplicar = process.argv.includes('--aplicar-local');
const cliente = new pg.Client({ connectionString: url.toString() });
await cliente.connect();
try {
  const permitidas = new Set(['20261010090000_atividades_usuarios','20261011220000_estrutura_fiscal_versionada','20261011230000_revisao_fiscal_prospectiva','20261011233000_atividade_estrutura_fiscal','20261012100000_brasilnfe_autonomia_tributaria','20261012120000_entradas_avulsas_versionadas','20261013020000_numeros_entradas_avulsas','20261013140000_convite_usuarios','20261013150000_atendimento_permissao_crm','20261013170000_atendimento_permissoes_granulares']);
  const aplicadas = await cliente.query('SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  const pastas = (await readdir('prisma/migrations', { withFileTypes: true })).filter(p => p.isDirectory()).map(p => p.name).sort();
  const pendentes = pastas.filter(p => !aplicadas.rows.some(a => a.migration_name === p));
  if (pendentes.some(p => !permitidas.has(p))) throw new Error('Migration pendente fora da revisão aditiva conhecida.');
  const estado = await cliente.query('SELECT current_database() AS banco, current_schema() AS esquema, (SELECT count(*) FROM "MovimentacaoEstoque") AS estoque, (SELECT count(*) FROM "LancamentoFinanceiro") AS financeiro, (SELECT count(*) FROM "NotaFiscalRecebida") AS recebidas');
  if (estado.rows[0].esquema !== 'public' || ['estoque','financeiro','recebidas'].some(k => estado.rows[0][k] !== '0')) throw new Error('Base fora do contrato administrativo isolado.');
  console.log(JSON.stringify({ banco: estado.rows[0].banco, pendentes, aplicar, transformacao: 'Somente protocoloCancelamento TEXT nullable equivalente; arquivos históricos preservados.' }));
  if (aplicar) for (const nome of pendentes) {
    const original = await readFile(`prisma/migrations/${nome}/migration.sql`, 'utf8');
    const sql = prepararSqlMigrationFiscal(nome, original);
    await cliente.query('BEGIN');
    try {
      await cliente.query(sql);
      await cliente.query('INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count) VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4,CURRENT_TIMESTAMP,1)', [randomUUID(), createHash('sha256').update(original).digest('hex'), nome, sql === original ? null : 'Reconciliação da adição equivalente: protocoloCancelamento TEXT nullable verificado.']);
      await cliente.query('COMMIT');
      console.log(JSON.stringify({ aplicadaLocalmente: nome }));
    } catch { await cliente.query('ROLLBACK'); throw new Error(`Falha na migration local ${nome}; nenhuma resposta de banco foi exposta.`); }
  }
} finally { await cliente.end(); }
