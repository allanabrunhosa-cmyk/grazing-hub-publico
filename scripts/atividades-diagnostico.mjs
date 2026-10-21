/** Diagnóstico administrativo somente leitura. Não carrega .env nem executa retenção. */
import { Client } from "pg";

const argumentos = process.argv.slice(2);
const contar = argumentos.includes("--contar");
const indiceSchema = argumentos.indexOf("--schema");
const esquema = indiceSchema < 0 ? "public" : argumentos[indiceSchema + 1];
if (!esquema || !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(esquema)
  || argumentos.some((arg, indice) => arg !== "--contar" && arg !== "--schema" && (indiceSchema < 0 || indice !== indiceSchema + 1))) {
  throw new Error("Uso: node scripts/atividades-diagnostico.mjs [--schema nome] [--contar]");
}
if (!process.env.DATABASE_URL) throw new Error("Informe explicitamente DATABASE_URL de uma conexão administrativa de leitura.");
const meses = categoria => {
  const valor = process.env[`ATIVIDADES_RETENCAO_MESES_${categoria}`] ?? "12";
  if (!/^\d{1,3}$/.test(valor) || Number(valor) < 1 || Number(valor) > 120) {
    throw new Error(`ATIVIDADES_RETENCAO_MESES_${categoria} deve ser um inteiro entre 1 e 120.`);
  }
  return Number(valor);
};
const politica = Object.fromEntries(["OPERACIONAL", "ACESSO", "CRITICA"].map(categoria => [categoria, { consultaOperacionalMeses: meses(categoria), descarteAutorizado: false }]));
const tabelasFonte = ["HistoricoAcesso", "HistoricoCadastroVenda", "HistoricoPedidoVenda", "HistoricoFinanceiroPedido", "HistoricoConciliacao", "HistoricoCartao", "HistoricoPorcaoInsumo", "HistoricoOrdemCategoriasPorcoes", "PedidoCompraHistorico", "EventoAuditoriaEtiqueta", "McpEvento", "Perda", "PerdaExclusao", "TentativaEtiqueta", "MovimentacaoEstoque", "Insumo", "EventoEstruturaFiscal"];
const banco = new Client({ connectionString: process.env.DATABASE_URL, application_name: "grazing-atividades-diagnostico", connectionTimeoutMillis: 10_000 });
try {
  await banco.connect();
  await banco.query("BEGIN TRANSACTION READ ONLY");
  await banco.query("SET LOCAL statement_timeout = '30s'");
  const relacao = await banco.query(`
    SELECT c.oid, c.reltuples::bigint AS estimativa_eventos,
           pg_relation_size(c.oid)::bigint AS heap_bytes,
           pg_table_size(c.oid)::bigint AS dados_toast_bytes,
           pg_indexes_size(c.oid)::bigint AS indices_bytes,
           pg_total_relation_size(c.oid)::bigint AS total_bytes
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = 'AtividadeUsuario' AND c.relkind = 'r'`, [esquema]);
  if (relacao.rows.length !== 1) throw new Error("Tabela de atividades não encontrada nesse schema; nenhuma alteração realizada.");
  const tamanho = relacao.rows[0];
  const quantidade = contar
    ? Number((await banco.query(`SELECT count(*)::bigint AS total FROM "${esquema}"."AtividadeUsuario"`)).rows[0].total)
    : Math.max(0, Number(tamanho.estimativa_eventos));
  const indices = await banco.query(`
    SELECT i.relname AS nome, pg_relation_size(i.oid)::bigint AS bytes
      FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
     WHERE x.indrelid = $1::oid ORDER BY i.relname`, [tamanho.oid]);
  const volume = contar ? await banco.query(`
    SELECT "categoria", count(*)::bigint AS eventos,
           min("ocorridoEm") AS inicio, max("ocorridoEm") AS ultimo
      FROM "${esquema}"."AtividadeUsuario" GROUP BY "categoria" ORDER BY "categoria"`) : { rows: [] };
  const fontes = await banco.query(`
    SELECT f.nome, c.oid IS NOT NULL AS disponivel, c.reltuples::bigint AS estimativa_registros,
           pg_table_size(c.oid)::bigint AS dados_toast_bytes,
           pg_indexes_size(c.oid)::bigint AS indices_bytes,
           pg_total_relation_size(c.oid)::bigint AS total_bytes
      FROM unnest($2::text[]) AS f(nome)
      LEFT JOIN pg_namespace n ON n.nspname = $1
      LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = f.nome AND c.relkind = 'r'
     ORDER BY f.nome`, [esquema, tabelasFonte]);
  const fontesRelacoes = fontes.rows.map(fonte => ({
    nome: fonte.nome, disponivel: fonte.disponivel,
    registrosAproximados: fonte.estimativa_registros === null || Number(fonte.estimativa_registros) < 0 ? null : Number(fonte.estimativa_registros),
    dadosEToastBytes: fonte.dados_toast_bytes === null ? null : Number(fonte.dados_toast_bytes),
    indicesBytes: fonte.indices_bytes === null ? null : Number(fonte.indices_bytes),
    totalBytes: fonte.total_bytes === null ? null : Number(fonte.total_bytes),
  }));
  const fontesTotais = fontesRelacoes.reduce((total, fonte) => ({
    dadosEToastBytes: total.dadosEToastBytes + (fonte.dadosEToastBytes ?? 0),
    indicesBytes: total.indicesBytes + (fonte.indicesBytes ?? 0), totalBytes: total.totalBytes + (fonte.totalBytes ?? 0),
  }), { dadosEToastBytes: 0, indicesBytes: 0, totalBytes: 0 });
  const bytesPorEvento = quantidade > 0 ? Number(tamanho.total_bytes) / quantidade : null;
  const projecoes = [1000, 5000, 10000].map(eventosDiarios => ({ eventosDiarios, eventosEm365Dias: eventosDiarios * 365, bytesDadosEIndicesEm365Dias: bytesPorEvento === null ? null : Math.round(bytesPorEvento * eventosDiarios * 365) }));
  await banco.query("COMMIT");
  console.log(JSON.stringify({
    medidoEm: new Date().toISOString(), esquema,
    volume: { eventos: quantidade, contagemExata: contar, estimativaPgClass: Number(tamanho.estimativa_eventos), porCategoria: volume.rows },
    armazenamento: { heapBytes: Number(tamanho.heap_bytes), dadosEToastBytes: Number(tamanho.dados_toast_bytes), indicesBytes: Number(tamanho.indices_bytes), totalBytes: Number(tamanho.total_bytes), indices: indices.rows.map(indice => ({ nome: indice.nome, bytes: Number(indice.bytes) })), bytesPorEvento, incluiWAL: false, incluiBackups: false },
    fontes: { contagemExata: false, relacoes: fontesRelacoes, totais: fontesTotais, incluiTabelaCentral: false, incluiWAL: false, incluiBackups: false },
    projecoes, retencao: { expurgoAtivo: false, politica, propostaInicial: "12 meses de consulta operacional; não é autorização de descarte nem prazo legal." },
    limitacoes: ["A média inclui páginas alocadas e pode variar com ocupação, campos, fragmentação e quantidade de eventos.", "As projeções lineares cobrem apenas a central; fontes originais, WAL, réplicas e backups devem ser dimensionados separadamente.", "O diagnóstico agrega categorias, sem nomes, detalhes dos eventos ou credenciais. --contar habilita contagem exata administrativa apenas da central.", "O volume das 17 fontes usa somente pg_class.reltuples, dependente de estatísticas; null indica relação ausente ou estimativa ainda indisponível. Os tamanhos vêm das funções PostgreSQL.", "McpEvento referenciado por atividade é preservado pela limpeza MCP. Seu crescimento permanece no total das fontes e não entra na projeção da central."]
  }, null, 2));
} catch {
  try { await banco.query("ROLLBACK"); } catch { /* Conexão indisponível; não há mutações. */ }
  console.error("Não foi possível obter o diagnóstico de atividades. Verifique destino, permissões e disponibilidade; nenhuma alteração realizada.");
  process.exitCode = 1;
} finally { await banco.end().catch(() => {}); }
