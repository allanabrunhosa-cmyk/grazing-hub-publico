// Recuperação da projeção por fontes reais. Nunca carrega .env nem imprime payloads.
import pg from "pg";
const fontes = new Set(["HistoricoAcesso", "HistoricoCadastroVenda", "HistoricoPedidoVenda", "HistoricoFinanceiroPedido",
  "HistoricoConciliacao", "HistoricoCartao", "HistoricoPorcaoInsumo", "HistoricoOrdemCategoriasPorcoes", "PedidoCompraHistorico",
  "EventoAuditoriaEtiqueta", "McpEvento", "Perda", "PerdaExclusao", "TentativaEtiqueta", "EventoEstruturaFiscal"]);
const args = process.argv.slice(2);
function parametro(nome, padrao) { const i = args.indexOf(nome); return i < 0 ? padrao : args[i + 1]; }
const fonte = parametro("--fonte"), schema = parametro("--schema", "public"), aplicar = args.includes("--aplicar");
const apos = parametro("--apos", ""), limite = Number(parametro("--limite", "5000"));
if (!fontes.has(fonte) || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(schema) || !/^[a-zA-Z0-9_-]{0,160}$/.test(apos)
  || !Number.isInteger(limite) || limite < 1 || limite > 50000) throw new Error("Informe fonte autorizada, schema, cursor e limite de 1 a 50000.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL explícita é obrigatória.");
if (aplicar && process.env.ATIVIDADES_RECUPERACAO_AUTORIZADA !== "SIM") throw new Error("Aplicação exige autorização operacional explícita e ATIVIDADES_RECUPERACAO_AUTORIZADA=SIM.");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: "atividades-recuperacao", connectionTimeoutMillis: 10000 });
let cursor = apos, lidas = 0, projetadas = 0;
try {
  await db.connect();
  // Limite de tamanho da operação e statement_timeout; commit por lote, fonte durável.
  while (lidas < limite) {
    await db.query(aplicar ? "BEGIN" : "BEGIN READ ONLY");
    await db.query(`SET LOCAL search_path TO "${schema}"`);
    await db.query("SET LOCAL statement_timeout = '15000'");
    const lote = Math.min(500, limite - lidas);
    if (aplicar) {
      const r = await db.query(`WITH origens AS MATERIALIZED (SELECT id, to_jsonb(t) AS registro FROM "${fonte}" t WHERE id > $1 ORDER BY id LIMIT $2),
        novas AS (SELECT id, grazing_projetar_atividade($3,registro) AS evento FROM origens)
        SELECT count(*)::int AS lidas, count(evento)::int AS projetadas, max(id) AS cursor FROM novas`, [cursor, lote, fonte]);
      lidas += r.rows[0].lidas; projetadas += r.rows[0].projetadas; cursor = r.rows[0].cursor ?? cursor;
      await db.query("COMMIT");
      if (r.rows[0].lidas < lote) break;
    } else {
      const r = await db.query(`SELECT id FROM "${fonte}" WHERE id > $1 ORDER BY id LIMIT $2`, [cursor, lote]);
      lidas += r.rowCount ?? 0; cursor = r.rows.at(-1)?.id ?? cursor;
      await db.query("COMMIT");
      if ((r.rowCount ?? 0) < lote) break;
    }
  }
  console.log(JSON.stringify({ modo: aplicar ? "APLICACAO_AUTORIZADA" : "SIMULACAO", fonte, lidas, referenciasProjetadasOuJaExistentes: aplicar ? projetadas : null, proximoCursor: cursor || null,
    aviso: "Sem cópia de payload, sem reconstrução de autoria e sem expurgo. Repita com --apos para continuar; fonte/id deduplica reprocessamentos." }));
} catch {
  await db.query("ROLLBACK").catch(() => {});
  console.error("Não foi possível recuperar a projeção. Verifique conexão, schema e privilégios no ambiente autorizado.");
  process.exitCode = 1;
} finally { await db.end().catch(() => {}); }
