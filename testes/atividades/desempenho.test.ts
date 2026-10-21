import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, totalmem, freemem, platform } from "node:os";
import { criarBancoTeste, encerrarBancoTeste, executarBanco } from "./banco-teste";

type Ambiente = Awaited<ReturnType<typeof criarBancoTeste>>;
const resumo = (valores: number[]) => {
  const ordenados = [...valores].sort((a, b) => a - b);
  return { amostras: valores.length, mediaMs: valores.reduce((a, b) => a + b, 0) / valores.length, p50Ms: ordenados[Math.floor((ordenados.length - 1) * .5)], p95Ms: ordenados[Math.floor((ordenados.length - 1) * .95)], minimoMs: ordenados[0], maximoMs: ordenados.at(-1) };
};
async function medirPar(antes: () => Promise<unknown>, depois: () => Promise<unknown>, amostras = 200) {
  for (let i = 0; i < 20; i++) { await antes(); await depois(); }
  const a: number[] = [], d: number[] = [];
  const executar = async (fn: () => Promise<unknown>, saida: number[]) => { const t = performance.now(); await fn(); saida.push(performance.now() - t); };
  for (let i = 0; i < amostras; i++) {
    if (i % 2 === 0) { await executar(antes, a); await executar(depois, d); }
    else { await executar(depois, d); await executar(antes, a); }
  }
  return { antes: resumo(a), depois: resumo(d), aquecimentoPorVariante: 20, ordemAlternada: true };
}
async function tamanho(ambiente: Ambiente, tabela: "HistoricoAcesso" | "AtividadeUsuario") {
  const r = (await ambiente.banco.query(`SELECT pg_relation_size($1::regclass)::bigint AS heap,
    pg_table_size($1::regclass)::bigint AS dados, pg_indexes_size($1::regclass)::bigint AS indices,
    pg_total_relation_size($1::regclass)::bigint AS total`, [`"${ambiente.esquema}"."${tabela}"`])).rows[0];
  const indices = (await ambiente.banco.query(`SELECT c.relname AS nome, pg_relation_size(c.oid)::bigint AS bytes
    FROM pg_index x JOIN pg_class c ON c.oid=x.indexrelid WHERE x.indrelid=$1::regclass ORDER BY c.relname`, [`"${ambiente.esquema}"."${tabela}"`])).rows;
  return { heapBytes: Number(r.heap), dadosEToastBytes: Number(r.dados), indicesBytes: Number(r.indices), totalBytes: Number(r.total), indices: indices.map(i => ({ nome: i.nome, bytes: Number(i.bytes) })) };
}
async function carregar(ambiente: Ambiente) {
  await ambiente.banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash",ativo,"updatedAt")
    SELECT 'bench-autor-'||g,'Autor sintético '||g,'bench-'||g||'@example.invalid','sem-login',true,NOW() FROM generate_series(0,99) g`);
  await ambiente.banco.query("SELECT set_config('grazing.atividade',$1,false)", [JSON.stringify({ origem: "API", correlacaoId: "benchmark-100k-sintetico" })]);
  const lsnAntes = (await ambiente.banco.query("SELECT pg_current_wal_insert_lsn() AS lsn")).rows[0].lsn;
  const inicio = performance.now();
  await ambiente.banco.query(`INSERT INTO "HistoricoAcesso" (id,"autorId",entidade,"entidadeId",acao,antes,depois,"createdAt")
    SELECT 'evento-'||lpad(g::text,6,'0'),
      CASE WHEN g%5=0 THEN 'bench-autor-0' ELSE 'bench-autor-'||(g%100)::text END,
      CASE WHEN g%2=0 THEN 'Usuário' ELSE 'Perfil' END,'bench-cadastro-'||(g%100)::text,
      CASE g%4 WHEN 0 THEN 'Usuário atualizado' WHEN 1 THEN 'Perfil atualizado' WHEN 2 THEN 'Usuário inativado' ELSE 'Usuário ativado' END,
      '{"ativo":true,"sessaoVersao":0}'::jsonb,'{"ativo":false,"sessaoVersao":1}'::jsonb,
      TIMESTAMP '2026-10-10 12:00:00' - (g * INTERVAL '5 minutes') FROM generate_series(1,100000) g`);
  const duracaoCargaMs = performance.now() - inicio;
  const wal = (await ambiente.banco.query("SELECT pg_wal_lsn_diff(pg_current_wal_insert_lsn(),$1::pg_lsn)::bigint AS bytes", [lsnAntes])).rows[0].bytes;
  await ambiente.banco.query('ANALYZE "HistoricoAcesso"');
  await ambiente.banco.query('ANALYZE "AtividadeUsuario"');
  return { eventos: 100000, duracaoCargaMs, walGeradoBytes: Number(wal) };
}
describe.skipIf(!executarBanco)("Atividades — 100 mil eventos sintéticos, PostgreSQL e comparação equivalente", () => {
  let antes: Ambiente, depois: Ambiente;
  beforeAll(async () => {
    antes = await criarBancoTeste("antes"); depois = await criarBancoTeste("depois");
    // Alteração somente no schema descartável de controle: conserva a auditoria original.
    await antes.banco.query('ALTER TABLE "HistoricoAcesso" DISABLE TRIGGER atividades_projetar_insert');
  }, 180_000);
  afterAll(async () => { await encerrarBancoTeste(antes); await encerrarBancoTeste(depois); });

  it("mede armazenamento, WAL e latências sem percentuais inventados", async () => {
    const centralVazia = await tamanho(depois, "AtividadeUsuario");
    const totalAntes = Number((await antes.banco.query('SELECT count(*) AS n FROM "AtividadeUsuario"')).rows[0].n);
    const totalDepois = Number((await depois.banco.query('SELECT count(*) AS n FROM "AtividadeUsuario"')).rows[0].n);
    const cargaAntes = await carregar(antes), cargaDepois = await carregar(depois);
    // Migrations podem produzir atividades próprias; a carga deve acrescentar exatamente seus 100 mil fatos.
    expect(Number((await depois.banco.query('SELECT count(*) AS n FROM "AtividadeUsuario"')).rows[0].n) - totalDepois).toBe(100000);
    expect(Number((await antes.banco.query('SELECT count(*) AS n FROM "AtividadeUsuario"')).rows[0].n) - totalAntes).toBe(0);
    const armazenamento = { auditoriaAntes: await tamanho(antes, "HistoricoAcesso"), auditoriaDepois: await tamanho(depois, "HistoricoAcesso"), centralVazia, centralDepois: await tamanho(depois, "AtividadeUsuario") };
    const bytesPorEvento = (armazenamento.centralDepois.totalBytes - centralVazia.totalBytes) / 100000;
    const sequencia = (await depois.banco.query('SELECT max(sequencia)::text AS limite FROM "AtividadeUsuario"')).rows[0].limite;
    const inicio = "2026-09-10T12:00:00.000Z", fim = "2026-10-11T00:00:00.000Z", cursorData = "2026-04-19T21:20:00.000Z";
    const camposOriginal = `id AS "fonteId", "createdAt" AT TIME ZONE 'UTC' AS instante, "autorId", acao, entidade`;
    const camposCentral = `"fonteId", "ocorridoEm" AS instante, "autorId", acao, entidade`;
    const consultas = [
      { nome: "primeiraPagina30Dias", sqlAntes: `SELECT ${camposOriginal} FROM "HistoricoAcesso" WHERE "autorId"=$1 AND "createdAt">=$2::timestamptz AT TIME ZONE 'UTC' AND "createdAt"<$3::timestamptz AT TIME ZONE 'UTC' ORDER BY "createdAt" DESC,id DESC LIMIT 50`, sqlDepois: `SELECT ${camposCentral} FROM "AtividadeUsuario" WHERE "autorId"=$1 AND "ocorridoEm">=$2 AND "ocorridoEm"<$3 AND sequencia<=$4::bigint ORDER BY "ocorridoEm" DESC,id DESC LIMIT 50`, argsAntes: ["bench-autor-0", inicio, fim], argsDepois: ["bench-autor-0", inicio, fim, sequencia] },
      { nome: "cursorProfundo", sqlAntes: `SELECT ${camposOriginal} FROM "HistoricoAcesso" WHERE "autorId"=$1 AND ("createdAt",id)<($2::timestamptz AT TIME ZONE 'UTC',$3) ORDER BY "createdAt" DESC,id DESC LIMIT 50`, sqlDepois: `SELECT ${camposCentral} FROM "AtividadeUsuario" WHERE "autorId"=$1 AND ("ocorridoEm",id)<($2::timestamptz,$3) AND sequencia<=$4::bigint ORDER BY "ocorridoEm" DESC,id DESC LIMIT 50`, argsAntes: ["bench-autor-0", cursorData, "zzzz"], argsDepois: ["bench-autor-0", cursorData, "zzzz", sequencia] },
      { nome: "periodoAcaoResultadoOrigem", sqlAntes: `SELECT ${camposOriginal} FROM "HistoricoAcesso" WHERE "autorId"=$1 AND "createdAt">=$2::timestamptz AT TIME ZONE 'UTC' AND acao='Usuário inativado' ORDER BY "createdAt" DESC,id DESC LIMIT 50`, sqlDepois: `SELECT ${camposCentral} FROM "AtividadeUsuario" WHERE "autorId"=$1 AND "ocorridoEm">=$2 AND modulo='acessos' AND acao='USUARIO_INATIVADO' AND resultado='SUCESSO' AND origem='API' AND sequencia<=$3::bigint ORDER BY "ocorridoEm" DESC,id DESC LIMIT 50`, argsAntes: ["bench-autor-0", inicio], argsDepois: ["bench-autor-0", inicio, sequencia] },
    ];
    const resultadosConsultas = [];
    for (const consulta of consultas) {
      const ra = await antes.banco.query(consulta.sqlAntes, consulta.argsAntes), rd = await depois.banco.query(consulta.sqlDepois, consulta.argsDepois);
      expect(rd.rows.map(r => r.fonteId)).toEqual(ra.rows.map(r => r.fonteId)); expect(rd.rows).toHaveLength(50);
      resultadosConsultas.push({ nome: consulta.nome,
        latencia: await medirPar(() => antes.banco.query(consulta.sqlAntes, consulta.argsAntes), () => depois.banco.query(consulta.sqlDepois, consulta.argsDepois)),
        explainAntes: (await antes.banco.query("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + consulta.sqlAntes, consulta.argsAntes)).rows[0]["QUERY PLAN"],
        explainDepois: (await depois.banco.query("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + consulta.sqlDepois, consulta.argsDepois)).rows[0]["QUERY PLAN"] });
    }
    const operar = async (ambiente: Ambiente) => {
      await ambiente.banco.query("BEGIN");
      try {
        await ambiente.banco.query('UPDATE "Usuario" SET ativo=NOT ativo,"updatedAt"=NOW() WHERE id=\'bench-autor-0\'');
        await ambiente.banco.query(`INSERT INTO "HistoricoAcesso" (id,"autorId",entidade,"entidadeId",acao,antes,depois)
          VALUES ($1,'bench-autor-0','Usuário','bench-autor-0','Usuário atualizado','{"ativo":true}','{"ativo":false}')`, [randomUUID()]);
        await ambiente.banco.query("COMMIT");
      } catch (erro) { await ambiente.banco.query("ROLLBACK"); throw erro; }
    };
    const operacoes = await medirPar(() => operar(antes), () => operar(depois));
    const ambientePg = (await depois.banco.query("SELECT version() AS postgres,current_setting('shared_buffers') AS shared_buffers,current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS synchronous_commit,current_setting('max_connections') AS max_connections,current_setting('timezone') AS timezone")).rows[0];
    const relatorio = { medidoEm: new Date().toISOString(), ambiente: { ...ambientePg, node: process.version, plataforma: platform(), cpusLogicos: cpus().length, memoriaTotalBytes: totalmem(), memoriaLivreBytes: freemem(), banco: "teste_atividades_usuarios", porta: 55441 },
      metodologia: { dataset: "100.000 fatos idênticos por variante; 100 autores, um com 20.000 fatos, período de 347 dias; somente dados sintéticos.", antes: "Mudança + auditoria HistoricoAcesso existente, trigger de projeção desativado somente no schema de controle.", depois: "Mesma mudança + mesma auditoria + projeção transacional via trigger da migration.", consultas: "50 eventos equivalentes; dataset todo originado por API/sucesso para comparação dos filtros, com cursor por data/id.", fasesSerializadas: true, amostras: 200, aquecimento: 20, caches: "Aquecidos, variantes alternadas; não há reinicialização ou limpeza de cache.", sincronizacaoDuravel: ambientePg.fsync === "on" && ambientePg.synchronous_commit !== "off" },
      cargaAntes, cargaDepois, armazenamento, bytesPorEventoCentral: bytesPorEvento,
      projecoes: [1000,5000,10000].map(eventosDiarios => ({ eventosDiarios, eventosEm365Dias: eventosDiarios*365, bytesDadosEIndicesCentralEm365Dias: Math.round(eventosDiarios*365*bytesPorEvento) })),
      operacoes, consultas: resultadosConsultas,
      limitacoes: ["Microbenchmark local PostgreSQL/Node; não reproduz rede, hardware ou concorrência da produção.", "Uma execução com caches aquecidos; não demonstra latência fria nem percentuais universais de impacto.", "Tamanho central é incremental; auditoria original permanece e está medida separadamente. WAL medido por diferença de LSN, separado dos dados/índices; backups não foram medidos.", "WAL é compartilhado pelo cluster: rodar este arquivo sem outros consumidores, usando --maxWorkers=1. Outras escritas concorrentes contaminariam essa amostra.", "A distribuição e o tamanho de resumos/diferenças podem mudar bytes por evento; projeção linear não é garantia de capacidade.", "Medições SQL não representam toda Server Action, autenticação, validação nem integrações externas."] };
    await mkdir(".tmp/atividades-usuarios", { recursive: true });
    await writeFile(".tmp/atividades-usuarios/desempenho.json", JSON.stringify(relatorio, null, 2));
    console.info(JSON.stringify({ eventosPorVariante: 100000, bytesPorEventoCentral: bytesPorEvento, totalCentralBytes: armazenamento.centralDepois.totalBytes, walAntesBytes: cargaAntes.walGeradoBytes, walDepoisBytes: cargaDepois.walGeradoBytes, operacoes, consultas: resultadosConsultas.map(c => ({ nome: c.nome, latencia: c.latencia })), relatorio: ".tmp/atividades-usuarios/desempenho.json" }));
  }, 180_000);
});
