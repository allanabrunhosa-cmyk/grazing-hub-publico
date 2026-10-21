import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepararSqlMigrationFiscal } from './reconciliacao-migrations-fiscais.mjs';
const sha = texto => createHash('sha256').update(texto).digest('hex');
const raizExecutor = fileURLToPath(new URL('../../', import.meta.url));
const especiais = new Set(['20261011100000_brasilnfe_preparacao_operacional', '20261011220000_estrutura_fiscal_versionada']);
const arquivosExecutor = ['scripts/lib/plano-migrations-fiscais.mjs', 'scripts/lib/reconciliacao-migrations-fiscais.mjs', 'scripts/migrations-publicacao-fiscal.mjs'];
const nomeValido = n => typeof n === 'string' && /^\d{14}_[a-z0-9_]+$/.test(n);
const identificador = nome => `"${nome.replaceAll('"', '""')}"`;
export const VERSAO_EXECUTOR_MIGRATIONS_FISCAIS = 3;
// Par fechado da exportação pública: mesma estrutura, sem o DML operacional privado.
// A SQL aplicada e o histórico do banco permanecem intactos. Não há override por env.
const cursorPublico = {
  nome: '20260909210000_sefaz_recuperacao_cursor_656',
  publicos: ["9462e484e87f398903b28c20c340f936c7d93d4df55ea0e53ce4dc508a0830aa","0bca536d59048c9eae5bf10e7c52781472af4a6db6333cd9a2b95ba059fc25b6"],
  historicos: ["e74b7e0e64af4a144d2c9a7d1becb578731ba4df429b37c1751086907f8f976c","a76af9072503ca04ba54ba7e834c1d442266b2b3255d083285d713db368d0837"],
};
export function checksumHistoricoCorresponde(original, checksum, nome) {
  // Não normaliza espaços ou SQL. A exceção abaixo exige nome e dois hashes exatos.
  const lf = original.replace(/\r\n/g, '\n');
  const hashes = [sha(original), sha(lf), sha(lf.replace(/\n/g, '\r\n'))];
  if (hashes.includes(checksum)) return true;
  return nome === cursorPublico.nome && cursorPublico.publicos.includes(sha(original)) && cursorPublico.historicos.includes(checksum);
}

export async function planejarMigrationsFiscais(cliente, opcoes = {}) {
  // Caminho alternativo é somente para fixtures sintéticas. O CLI usa o repositório do executor.
  if (opcoes.raizMigrations !== undefined && process.env.NODE_ENV !== 'test') throw Error('Diretório alternativo permitido somente na suíte sintética.');
  const raizMigrations = resolve(opcoes.raizMigrations ?? resolve(raizExecutor, 'prisma/migrations'));
  const [destino] = (await cliente.query(`SELECT current_database() AS banco, current_user AS usuario, current_schema() AS esquema,
    current_setting('search_path') AS search_path, current_setting('server_version_num') AS versao_postgresql,
    current_setting('standard_conforming_strings') AS strings_padrao,
    inet_server_addr()::text AS endereco, inet_server_port() AS porta,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS banco_oid,
    (SELECT oid::text FROM pg_namespace WHERE nspname=current_schema()) AS esquema_oid`)).rows;
  if (!destino?.banco || !destino.esquema || !destino.banco_oid || !destino.esquema_oid || destino.strings_padrao !== 'on' || destino.esquema.startsWith('pg_') || destino.esquema === 'information_schema') throw Error('Destino de migrations não confirmado.');
  const params = cliente.connectionParameters ?? {};
  const destinoHash = sha(JSON.stringify({ ...destino, conexao: { host: typeof params.host === 'string' ? params.host : null, porta: typeof params.port === 'number' ? params.port : null } }));
  const historia = `${identificador(destino.esquema)}."_prisma_migrations"`;
  const [tabela] = (await cliente.query('SELECT to_regclass($1) IS NOT NULL AS existe', [historia])).rows;
  const rows = tabela?.existe ? (await cliente.query(`SELECT id, migration_name, checksum, finished_at, rolled_back_at FROM ${historia} ORDER BY migration_name,id`)).rows : [];
  if (rows.some(r => !nomeValido(r.migration_name) || !/^[a-f0-9]{64}$/.test(r.checksum) || !r.finished_at && !r.rolled_back_at || r.finished_at && r.rolled_back_at)) throw Error('Histórico de migrations incompleto ou incompatível exige conferência.');
  const pastas = (await readdir(raizMigrations, { withFileTypes: true })).filter(p => p.isDirectory()).map(p => p.name).sort();
  const pendentes = [];
  for (const nome of pastas) {
    if (!nomeValido(nome)) throw Error('Nome de migration fora do contrato.');
    const original = await readFile(resolve(raizMigrations, nome, 'migration.sql'), 'utf8');
    const aplicadas = rows.filter(r => r.migration_name === nome && r.finished_at && !r.rolled_back_at);
    if (aplicadas.length > 1 || aplicadas.some(r => !checksumHistoricoCorresponde(original, r.checksum, nome))) throw Error('Checksum ou registro aplicado diverge do SQL histórico. Arquivos e histórico devem ser conferidos.');
    if (!aplicadas.length) pendentes.push({ nome, checksum: sha(original), original });
  }
  const codigoExecutor = [];
  for (const arquivo of arquivosExecutor) codigoExecutor.push({ arquivo, checksum: sha(await readFile(resolve(raizExecutor, arquivo), 'utf8')) });
  const historico = rows.map(r => ({ id: r.id, nome: r.migration_name, checksum: r.checksum, situacao: r.finished_at ? 'APLICADA' : 'REVERTIDA' }));
  const hash = sha(JSON.stringify({ versaoExecutor: VERSAO_EXECUTOR_MIGRATIONS_FISCAIS, nodeMajor: process.versions.node.split('.')[0], codigoExecutor, destinoHash, historico, pendentes: pendentes.map(({ nome, checksum }) => ({ nome, checksum })) }));
  return { hash, destinoHash, versaoExecutor: VERSAO_EXECUTOR_MIGRATIONS_FISCAIS, exigeCompatibilidade: pendentes.some(p => especiais.has(p.nome)), pendentes, raizMigrations, esquema: destino.esquema };
}
export const resumoPlanoMigrationsFiscais = plano => ({ hash: plano.hash, destinoHash: plano.destinoHash, versaoExecutor: plano.versaoExecutor, exigeCompatibilidade: plano.exigeCompatibilidade, pendentes: plano.pendentes.map(({ nome, checksum }) => ({ nome, checksum })) });

export function sqlSemTransacaoExterna(sql) {
  if (typeof sql !== 'string' || Buffer.byteLength(sql) > 64 * 1024 * 1024) throw Error('SQL fora do limite do executor.');
  let i = 0, inicio = 0, tokens = '', saida = '', ultimoFim = 0;
  const instrucoes = [];
  while (i < sql.length) {
    if (sql.startsWith('--', i)) { const fim = sql.indexOf('\n', i + 2); i = fim < 0 ? sql.length : fim + 1; tokens += ' '; continue; }
    if (sql.startsWith('/*', i)) {
      let nivel = 1; i += 2;
      while (i < sql.length && nivel) { if (sql.startsWith('/*', i)) { nivel++; i += 2; } else if (sql.startsWith('*/', i)) { nivel--; i += 2; } else i++; }
      if (nivel) throw Error('Comentário SQL incompleto.'); tokens += ' '; continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const aspa = sql[i], escape = aspa === "'" && /[Ee]/.test(sql[i - 1] ?? '') && !/[A-Za-z0-9_$]/.test(sql[i - 2] ?? ''); i++; tokens += ' LITERAL '; let fechou = false;
      while (i < sql.length) { if (sql[i] === '\\' && escape) { i += 2; continue; } if (sql[i++] === aspa) { if (sql[i] === aspa) i++; else { fechou = true; break; } } }
      if (!fechou) throw Error('Literal SQL incompleto.'); continue;
    }
    const dollar = sql[i] === '$' && !/[A-Za-z0-9_$]/.test(sql[i - 1] ?? '') ? sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0] : null;
    if (dollar) { const fim = sql.indexOf(dollar, i + dollar.length); if (fim < 0) throw Error('Corpo SQL incompleto.'); tokens += ' CORPO '; i = fim + dollar.length; continue; }
    if (sql[i] === ';') { instrucoes.push({ inicio, fim: i + 1, tokens: tokens.trim().replace(/\s+/g, ' ').toUpperCase() }); inicio = ++i; tokens = ''; continue; }
    tokens += sql[i++];
  }
  if (tokens.trim()) instrucoes.push({ inicio, fim: sql.length, tokens: tokens.trim().replace(/\s+/g, ' ').toUpperCase() });
  for (const instrucao of instrucoes) {
    ultimoFim = instrucao.fim; const t = instrucao.tokens;
    if (/^(?:BEGIN|COMMIT)(?: (?:WORK|TRANSACTION))?$/.test(t) || t === 'START TRANSACTION') continue;
    if (/^(?:BEGIN|COMMIT|START TRANSACTION|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE TRANSACTION|SET TRANSACTION|SET SESSION CHARACTERISTICS|SET (?:LOCAL |SESSION )?STANDARD_CONFORMING_STRINGS)\b/.test(t)) throw Error('Controle de transação SQL não suportado. Conferir migration antes de aplicar.');
    saida += sql.slice(instrucao.inicio, instrucao.fim);
  }
  return saida + sql.slice(ultimoFim);
}
export async function aplicarPlanoMigrationsFiscais(cliente, plano, hashAprovado) {
  if (!/^[a-f0-9]{64}$/.test(hashAprovado ?? '') || hashAprovado !== plano.hash) throw Error('Plano de migrations não aprovado ou desatualizado.');
  await cliente.query("SELECT pg_advisory_lock(hashtext('grazing-migrations-fiscais'))");
  try {
    const atual = await planejarMigrationsFiscais(cliente, { ...(process.env.NODE_ENV === 'test' && plano.raizMigrations ? { raizMigrations: plano.raizMigrations } : {}) });
    if (atual.hash !== plano.hash) throw Error('Destino, código ou histórico mudou após a revisão do plano.');
    if (!atual.pendentes.length) return { aplicadas: [] };
    const historia = `${identificador(atual.esquema)}."_prisma_migrations"`;
    await cliente.query(`CREATE TABLE IF NOT EXISTS ${historia} (id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0)`);
    const aplicadas = [];
    for (const p of atual.pendentes) {
      const sql = sqlSemTransacaoExterna(prepararSqlMigrationFiscal(p.nome, p.original));
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query(`INSERT INTO ${historia} (id,checksum,finished_at,migration_name,logs,started_at,applied_steps_count) VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4,CURRENT_TIMESTAMP,1)`, [randomUUID(), p.checksum, p.nome, especiais.has(p.nome) ? 'Reconciliação: adição equivalente TEXT nullable conferida; SQL e checksum históricos preservados.' : null]);
        await cliente.query('COMMIT'); aplicadas.push(p.nome);
      } catch { await cliente.query('ROLLBACK'); throw Error(`Migration ${p.nome} não aplicada. Conferir o plano e o banco; dados internos suprimidos.`); }
    }
    return { aplicadas };
  } finally { await cliente.query("SELECT pg_advisory_unlock(hashtext('grazing-migrations-fiscais'))"); }
}
