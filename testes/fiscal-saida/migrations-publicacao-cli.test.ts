import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ connect: vi.fn(), end: vi.fn(), criar: vi.fn(), planejar: vi.fn(), aplicar: vi.fn(), resumo: vi.fn() }));
vi.mock("pg", () => ({ default: { Client: class { constructor(...args: unknown[]) { mocks.criar(...args); } connect = mocks.connect; end = mocks.end; } } }));
vi.mock("../../scripts/lib/plano-migrations-fiscais.mjs", () => ({ planejarMigrationsFiscais: mocks.planejar, aplicarPlanoMigrationsFiscais: mocks.aplicar, resumoPlanoMigrationsFiscais: mocks.resumo }));
const argumentos = process.argv, exitCode = process.exitCode;
const executar = async (...args: string[]) => { process.argv = ["node", "scripts/migrations-publicacao-fiscal.mjs", ...args]; await import("../../scripts/migrations-publicacao-fiscal.mjs"); };
describe("CLI fiscal sem publicação implícita", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks(); process.exitCode = undefined;
    vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("DATABASE_URL", "postgresql://sintetico:segredo_sintetico@127.0.0.1:55449/teste_cli");
    vi.stubEnv("MIGRACOES_FISCAIS_PLANO_APROVADO", "a".repeat(64));
    mocks.criar.mockImplementation(() => {}); mocks.connect.mockResolvedValue(undefined); mocks.end.mockResolvedValue(undefined); mocks.aplicar.mockResolvedValue({ aplicadas: ["20261011100000_exemplo"] });
    mocks.planejar.mockResolvedValue({ hash: "a".repeat(64), exigeCompatibilidade: false, pendentes: [{ nome: "20261011100000_exemplo" }] });
    mocks.resumo.mockReturnValue({ hash: "a".repeat(64), pendentes: [{ nome: "20261011100000_exemplo" }] });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); process.argv = argumentos; process.exitCode = exitCode; });
  it.each([{ args: [] }, { args: ["--planejar"] }])("apenas planeja e nunca aplica sem bootstrap: %j", async ({ args }) => {
    await executar(...args); expect(mocks.planejar).toHaveBeenCalledOnce(); expect(mocks.aplicar).not.toHaveBeenCalled(); expect(mocks.end).toHaveBeenCalledOnce(); expect(process.exitCode).toBeUndefined();
  });
  it("exige aprovação mesmo quando a migration pendente não é especial", async () => {
    await executar("--bootstrap"); expect(mocks.aplicar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ exigeCompatibilidade: false }), "a".repeat(64)); expect(process.exitCode).toBeUndefined();
  });
  it("não muda banco sem aprovação e não imprime objeto de erro", async () => {
    vi.stubEnv("MIGRACOES_FISCAIS_PLANO_APROVADO", ""); mocks.aplicar.mockRejectedValue(new Error("token=segredo_sintetico; resposta privada"));
    await executar("--bootstrap"); expect(mocks.aplicar).toHaveBeenCalledWith(expect.anything(), expect.anything(), ""); expect(process.exitCode).toBe(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/segredo_sintetico|token=|resposta privada|postgresql/);
  });
  it("bootstrap sem pendência não reaplica nem altera ledger", async () => {
    mocks.planejar.mockResolvedValue({ hash: "a".repeat(64), exigeCompatibilidade: false, pendentes: [] });
    await executar("--bootstrap"); expect(mocks.aplicar).not.toHaveBeenCalled(); expect(process.exitCode).toBeUndefined();
  });
  it.each([{ args: ["--executar"] }, { args: ["--bootstrap", "--planejar"] }])("recusa argumentos inválidos antes de criar conexão: %j", async ({ args }) => {
    await executar(...args); expect(mocks.criar).not.toHaveBeenCalled(); expect(mocks.connect).not.toHaveBeenCalled(); expect(process.exitCode).toBe(1);
  });
  it.each([undefined, "", "postgresql://", "postgresql://127.0.0.1:55449/", "https://127.0.0.1/teste_cli", " postgres://127.0.0.1/teste_cli"])("recusa destino ausente ou inválido sem fallback PG: %s", async conexao => {
    vi.stubEnv("DATABASE_URL", conexao); vi.stubEnv("PGHOST", "host_sintetico_proibido");
    await executar("--bootstrap"); expect(mocks.criar).not.toHaveBeenCalled(); expect(mocks.connect).not.toHaveBeenCalled(); expect(mocks.aplicar).not.toHaveBeenCalled(); expect(process.exitCode).toBe(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/postgresql:\/\/|host_sintetico_proibido|segredo_sintetico/);
  });
  it("construtor com configuração inválida permanece no tratamento saneado", async () => {
    mocks.criar.mockImplementation(() => { throw Error("postgresql://token=segredo_sintetico"); });
    await executar("--planejar"); expect(process.exitCode).toBe(1); expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/segredo_sintetico|postgresql/);
  });
  it("erro ao encerrar a conexão não escapa com dados externos", async () => {
    mocks.end.mockRejectedValue(Error("resposta privada; segredo_sintetico")); await executar("--planejar"); expect(process.exitCode).toBe(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/segredo_sintetico|resposta privada/);
  });
});
