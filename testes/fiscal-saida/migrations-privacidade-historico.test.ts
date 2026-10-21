import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { checksumHistoricoCorresponde, planejarMigrationsFiscais } from "../../scripts/lib/plano-migrations-fiscais.mjs";

const nome = "20260909210000_sefaz_recuperacao_cursor_656";
const historicos = ["e74b7e0e64af4a144d2c9a7d1becb578731ba4df429b37c1751086907f8f976c","a76af9072503ca04ba54ba7e834c1d442266b2b3255d083285d713db368d0837"];
const publica = readFileSync(new URL("./fixtures/migration-cursor-publica.sql", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const pastas: string[] = [];
afterEach(async () => {
  for (const pasta of pastas.splice(0)) {
    if (!resolve(pasta).startsWith(resolve(tmpdir()) + sep)) throw Error("Temporário fora da raiz de teste");
    await rm(pasta, { recursive: true });
  }
});
async function preparar(sql = publica, migration = nome) {
  const raiz = await mkdtemp(join(tmpdir(), "mp-")); pastas.push(raiz);
  await mkdir(join(raiz, migration)); await writeFile(join(raiz, migration, "migration.sql"), sql);
  return { raizMigrations: raiz };
}
const destino = { banco: "sintetico", usuario: "sintetico", esquema: "public", search_path: "public", strings_padrao: "on", banco_oid: "10001", esquema_oid: "2200", versao_postgresql: "160000" };
type Historico = { id: string; migration_name: string; checksum: string; finished_at: string | null; rolled_back_at: null };
const registro = (checksum = historicos[0], migration = nome): Historico => ({ id: "historico-sintetico", migration_name: migration, checksum, finished_at: "2026-01-01", rolled_back_at: null });
function cliente(rows = [registro()], existe = true) {
  return { query: vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT current_database")) return { rows: [destino] };
    if (sql.startsWith("SELECT to_regclass")) return { rows: [{ existe }] };
    if (sql.startsWith("SELECT id, migration_name")) return { rows };
    throw Error("Teste permite somente planejamento em leitura.");
  }) };
}

describe("Exportação pública sem reexecutar dados operacionais históricos", () => {
  it.each(historicos)("aceita somente o par conhecido de arquivo público e checksum histórico %s", checksum => {
    expect(checksumHistoricoCorresponde(publica, checksum, nome)).toBe(true);
    expect(checksumHistoricoCorresponde(publica.replaceAll("\n", "\r\n"), checksum, nome)).toBe(true);
    expect(checksumHistoricoCorresponde(publica.replace("\n", "\r\n"), checksum, nome)).toBe(false);
    expect(checksumHistoricoCorresponde(publica, checksum, "20260101000000_outro")).toBe(false);
    expect(checksumHistoricoCorresponde(publica + " ", checksum, nome)).toBe(false);
    expect(checksumHistoricoCorresponde(publica.replace("BOOLEAN", "TEXT"), checksum, nome)).toBe(false);
    expect(checksumHistoricoCorresponde(publica, "0".repeat(64), nome)).toBe(false);
  });
  it("preserva o registro aplicado e não agenda a recuperação antiga", async () => {
    const rows = [registro()], antes = JSON.stringify(rows), db = cliente(rows);
    const plano = await planejarMigrationsFiscais(db, await preparar());
    expect(plano.pendentes).toEqual([]); expect(JSON.stringify(rows)).toBe(antes);
    expect(db.query.mock.calls.every(([sql]) => sql.startsWith("SELECT "))).toBe(true);
  });
  it("instalação nova recebe somente DDL público, sem recuperação de cursor", async () => {
    const plano = await planejarMigrationsFiscais(cliente([], false), await preparar());
    expect(plano.pendentes).toHaveLength(1); expect(plano.pendentes[0].original).toBe(publica);
    expect(publica).not.toMatch(/\b(?:INSERT INTO|UPDATE\s+"|DELETE FROM|COPY\s+)/i);
  });
  it("mantém bloqueios de SQL alterada, histórico incompleto e registro duplicado", async () => {
    await expect(planejarMigrationsFiscais(cliente(), await preparar(publica + " "))).rejects.toThrow("Checksum");
    await expect(planejarMigrationsFiscais(cliente([{ ...registro(), finished_at: null }]), await preparar())).rejects.toThrow("incompleto");
    await expect(planejarMigrationsFiscais(cliente([registro(), registro()]), await preparar())).rejects.toThrow("Checksum");
  });
});
