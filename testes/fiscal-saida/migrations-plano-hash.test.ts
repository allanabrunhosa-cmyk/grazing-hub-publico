import { beforeEach, describe, expect, it, vi } from "vitest";
const dados = vi.hoisted(() => ({ sql: "CREATE TABLE sintetica(id TEXT);", executor: new Map<string, string>() }));
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(async () => [{ name: "20260101000000_sintetica", isDirectory: () => true }]),
  readFile: vi.fn(async (caminho: string) => caminho.replaceAll("\\", "/").endsWith("migration.sql") ? dados.sql : dados.executor.get(caminho.replaceAll("\\", "/").split("/scripts/")[1]) ?? "executor sintetico"),
}));
import { planejarMigrationsFiscais, resumoPlanoMigrationsFiscais } from "../../scripts/lib/plano-migrations-fiscais.mjs";
const destino = { banco: "teste_sintetico", usuario: "sintetico", esquema: "teste_hash", search_path: "teste_hash", versao_postgresql: "160000", strings_padrao: "on", endereco: "127.0.0.1", porta: 55449, banco_oid: "10001", esquema_oid: "10002" };
const cliente = (alteracao: Record<string, unknown> = {}) => ({ connectionParameters: { host: "127.0.0.1", port: 55449, password: "segredo_sintetico" }, query: vi.fn(async (sql: string) => ({ rows: sql.startsWith("SELECT current_database") ? [{ ...destino, ...alteracao }] : [{ existe: false }] })) });
describe("Hash vincula aprovação ao executor e destino fiscal", () => {
  beforeEach(() => { dados.sql = "CREATE TABLE sintetica(id TEXT);"; dados.executor.clear(); });
  it.each(["lib/plano-migrations-fiscais.mjs", "lib/reconciliacao-migrations-fiscais.mjs", "migrations-publicacao-fiscal.mjs"])("alterar %s invalida aprovação sem tocar no banco", async arquivo => {
    const anterior = await planejarMigrationsFiscais(cliente()); dados.executor.set(arquivo, "nova versão sintética do executor");
    const novo = await planejarMigrationsFiscais(cliente()); expect(novo.hash).not.toBe(anterior.hash); expect(novo.destinoHash).toBe(anterior.destinoHash);
  });
  it.each([{ banco: "teste_outro" }, { esquema: "teste_outro", esquema_oid: "10003" }, { usuario: "outro" }, { endereco: "127.0.0.2" }])("outro destino ou identidade não reutiliza aprovação: %j", async alteracao => {
    const anterior = await planejarMigrationsFiscais(cliente()); const novo = await planejarMigrationsFiscais(cliente(alteracao)); expect(novo.hash).not.toBe(anterior.hash); expect(novo.destinoHash).not.toBe(anterior.destinoHash);
  });
  it("relatório não expõe parâmetros privados de conexão", async () => {
    const plano = await planejarMigrationsFiscais(cliente()); expect(JSON.stringify(resumoPlanoMigrationsFiscais(plano))).not.toMatch(/segredo_sintetico|teste_hash|teste_sintetico|127\.0\.0\.1/);
  });
});
