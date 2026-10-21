import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { aplicarPlanoMigrationsFiscais, planejarMigrationsFiscais, resumoPlanoMigrationsFiscais } from "../../scripts/lib/plano-migrations-fiscais.mjs";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const antigas = ["20261011100000_brasilnfe_preparacao_operacional", "20261011220000_estrutura_fiscal_versionada"];
const esquemas: string[] = [], clientes: Client[] = []; let administracao: Client, bancoUrl: string;
const baseNome = "20260101000000_base_sintetica", textoNome = "20260102000000_texto_transacional";
const protocolo = "900719925474099312345678901234";
async function massa(coluna = "TEXT") {
  const esquema = `teste_migrations_fiscal_${randomUUID().replaceAll("-", "")}`, raizMigrations = resolve(".tmp/autonomia-fiscal", esquema, "migrations");
  await administracao.query(`CREATE SCHEMA "${esquema}"`); esquemas.push(esquema);
  const cliente = new Client({ connectionString: bancoUrl }); await cliente.connect(); clientes.push(cliente); await cliente.query(`SET search_path TO "${esquema}"`);
  const base = `CREATE TABLE "DocumentoFiscalSaida"(id TEXT PRIMARY KEY,"protocoloCancelamento" ${coluna});
CREATE TABLE "ConfiguracaoBrasilNfe"(id TEXT PRIMARY KEY);
CREATE TABLE "GrupoFiscalVenda"(id TEXT PRIMARY KEY,nome TEXT,fiscal JSONB,ativo BOOLEAN,versao INTEGER);
INSERT INTO "DocumentoFiscalSaida"(id,"protocoloCancelamento") VALUES('documento-exclusivamente-ficticio','${coluna === "INTEGER" ? "7" : protocolo}');`;
  const texto = `BEGIN;\nCREATE TABLE "TextoSintetico"(valor TEXT);\nINSERT INTO "TextoSintetico" VALUES($controle$BEGIN;\nCOMMIT;$controle$);\nCREATE FUNCTION codigo_sintetico() RETURNS TEXT LANGUAGE plpgsql AS $funcao$\nBEGIN\n RETURN 'COMMIT;';\nEND $funcao$;\nCOMMIT;`;
  for (const [nome, sql] of [[baseNome, base], [textoNome, texto], ...await Promise.all(antigas.map(async nome => [nome, await readFile(`prisma/migrations/${nome}/migration.sql`, "utf8")]))]) { await mkdir(resolve(raizMigrations, nome), { recursive: true }); await writeFile(resolve(raizMigrations, nome, "migration.sql"), sql); }
  return { cliente, esquema, raizMigrations, base, texto, planejar: () => planejarMigrationsFiscais(cliente, { raizMigrations }) };
}
describe.skipIf(process.env.BRASILNFE_BANCO_TESTE !== "1")("Executor fiscal: schemas sintéticos exclusivos, nenhuma produção", () => {
  beforeAll(async () => {
    const u = new URL(process.env.DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(u.hostname) || u.port !== "55449" || !/^\/teste_/.test(u.pathname)) throw new Error("Cluster e banco exclusivamente sintéticos obrigatórios.");
    bancoUrl = u.toString(); administracao = new Client({ connectionString: bancoUrl }); await administracao.connect();
  });
  afterAll(async () => {
    for (const c of clientes) await c.end();
    for (const esquema of esquemas) { if (!/^teste_migrations_fiscal_[a-f0-9]{32}$/.test(esquema)) throw new Error("Schema fora da massa sintética."); await administracao.query(`DROP SCHEMA "${esquema}" CASCADE`); }
    await administracao?.end();
  });
  it("reconcilia a coluna equivalente, preserva dados e registra checksums originais Prisma", async () => {
    const m = await massa(), p = await m.planejar(), antes = await Promise.all(antigas.map(async nome => sha(await readFile(`prisma/migrations/${nome}/migration.sql`, "utf8"))));
    expect(p.exigeCompatibilidade).toBe(true); expect(p.pendentes).toHaveLength(4);
    await expect(aplicarPlanoMigrationsFiscais(m.cliente, p, "0".repeat(64))).rejects.toThrow("não aprovado");
    expect((await m.cliente.query("SELECT to_regclass('_prisma_migrations') AS id")).rows[0].id).toBeNull();
    await aplicarPlanoMigrationsFiscais(m.cliente, p, p.hash);
    const rows = (await m.cliente.query("SELECT migration_name,checksum FROM _prisma_migrations ORDER BY migration_name")).rows;
    for (const r of rows) expect(r.checksum).toBe(sha(await readFile(resolve(m.raizMigrations, r.migration_name, "migration.sql"), "utf8")));
    expect((await m.cliente.query('SELECT "protocoloCancelamento" FROM "DocumentoFiscalSaida"')).rows[0].protocoloCancelamento).toBe(protocolo);
    expect((await m.cliente.query('SELECT valor FROM "TextoSintetico"')).rows[0].valor).toBe("BEGIN;\nCOMMIT;");
    expect((await m.cliente.query("SELECT codigo_sintetico() AS valor")).rows[0].valor).toBe("COMMIT;");
    expect(await Promise.all(antigas.map(async nome => sha(await readFile(`prisma/migrations/${nome}/migration.sql`, "utf8"))))).toEqual(antes);
    const reexecucao = await m.planejar(); expect(reexecucao.pendentes).toHaveLength(0); expect(await aplicarPlanoMigrationsFiscais(m.cliente, reexecucao, reexecucao.hash)).toEqual({ aplicadas: [] });
    expect((await m.cliente.query("SELECT count(*)::int AS n FROM _prisma_migrations")).rows[0].n).toBe(4);
  });
  it("hash aprovado não autoriza outro esquema e relatório suprime o destino bruto", async () => {
    const a = await massa(), b = await massa(), p = await a.planejar();
    expect((await b.planejar()).destinoHash).not.toBe(p.destinoHash);
    await expect(aplicarPlanoMigrationsFiscais(b.cliente, p, p.hash)).rejects.toThrow("Destino");
    expect((await b.cliente.query("SELECT to_regclass('_prisma_migrations') AS id")).rows[0].id).toBeNull();
    expect(JSON.stringify(resumoPlanoMigrationsFiscais(p))).not.toContain(a.esquema);
  });
  it("SQL externo COMMIT não deixa efeito parcial quando a última instrução falha", async () => {
    const m = await massa(), p = await m.planejar(); await aplicarPlanoMigrationsFiscais(m.cliente, p, p.hash);
    const nome = "20261014000000_rollback_sintetico"; await mkdir(resolve(m.raizMigrations, nome));
    await writeFile(resolve(m.raizMigrations, nome, "migration.sql"), 'BEGIN;CREATE TABLE "NaoPodePersistir"(id TEXT);COMMIT;SELECT 1/0;');
    const falha = await m.planejar(); await expect(aplicarPlanoMigrationsFiscais(m.cliente, falha, falha.hash)).rejects.toThrow("não aplicada");
    expect((await m.cliente.query('SELECT to_regclass(\'"NaoPodePersistir"\') AS id')).rows[0].id).toBeNull();
    expect((await m.cliente.query("SELECT count(*)::int AS n FROM _prisma_migrations")).rows[0].n).toBe(4);
  });
  it.each(["INTEGER", "TEXT NOT NULL", "TEXT DEFAULT 'origem-incompativel'"])("coluna histórica%s não é ignorada e não tem dados convertidos", async coluna => {
    const m = await massa(coluna), p = await m.planejar(); await expect(aplicarPlanoMigrationsFiscais(m.cliente, p, p.hash)).rejects.toThrow("não aplicada");
    expect((await m.cliente.query("SELECT count(*)::int AS n FROM _prisma_migrations WHERE migration_name=$1", [antigas[0]])).rows[0].n).toBe(0);
    expect(String((await m.cliente.query('SELECT "protocoloCancelamento" FROM "DocumentoFiscalSaida"')).rows[0].protocoloCancelamento)).toBe(coluna === "INTEGER" ? "7" : protocolo);
    expect((await m.cliente.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema=$1 AND table_name='DocumentoFiscalSaida' AND column_name='ultimaSequenciaObservada'", [m.esquema])).rows[0].n).toBe(0);
  });
  it("migration failed bloqueia, e checksum divergente não passa como histórico válido", async () => {
    const m = await massa(), p = await m.planejar(); await aplicarPlanoMigrationsFiscais(m.cliente, p, p.hash);
    await m.cliente.query("UPDATE _prisma_migrations SET finished_at=NULL WHERE migration_name=$1", [baseNome]);
    await expect(m.planejar()).rejects.toThrow("incompleto");
    await m.cliente.query("UPDATE _prisma_migrations SET finished_at=now(),checksum=$1 WHERE migration_name=$2", ["a".repeat(64), baseNome]);
    await expect(m.planejar()).rejects.toThrow("Checksum");
  });
  it("LF/CRLF do ledger é compatível; mudança de conteúdo depois da aprovação invalida o plano", async () => {
    const m = await massa(), p = await m.planejar(); await aplicarPlanoMigrationsFiscais(m.cliente, p, p.hash);
    await m.cliente.query("UPDATE _prisma_migrations SET checksum=$1 WHERE migration_name=$2", [sha(m.texto.replaceAll("\n", "\r\n")), textoNome]);
    expect((await m.planejar()).pendentes).toHaveLength(0);
    const n = await massa(), aprovado = await n.planejar(); await writeFile(resolve(n.raizMigrations, textoNome, "migration.sql"), n.texto + "\nSELECT 1;");
    await expect(aplicarPlanoMigrationsFiscais(n.cliente, aprovado, aprovado.hash)).rejects.toThrow("mudou");
    expect((await n.cliente.query("SELECT to_regclass('_prisma_migrations') AS id")).rows[0].id).toBeNull();
  });
});
