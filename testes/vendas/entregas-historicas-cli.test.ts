import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ ler: vi.fn(), salvar: vi.fn(), sha: vi.fn(), prepararSaida: vi.fn(), liberar: vi.fn(), guardas: vi.fn(), codigo: vi.fn(), preparar: vi.fn(), aplicar: vi.fn(), prepararReversao: vi.fn(), reverter: vi.fn(), entradaHash: vi.fn(), fonte: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: { $disconnect: vi.fn() } }));
vi.mock("../../src/lib/vendas/entregas-historicas-dominio", () => ({ validarFonteEntregasHistoricas: mocks.fonte, hashEntradaFonteEntregasHistoricas: mocks.entradaHash }));
vi.mock("../../src/lib/vendas/entregas-historicas", () => ({ prepararEnriquecimentoEntregasHistoricas: mocks.preparar, aplicarEnriquecimentoEntregasHistoricas: mocks.aplicar, prepararReversaoEntregasHistoricas: mocks.prepararReversao, reverterEnriquecimentoEntregasHistoricas: mocks.reverter }));
vi.mock("../../scripts/entregas-historicas-arquivos", () => ({ lerJsonEntregas: mocks.ler, salvarJsonEntregas: mocks.salvar, shaArquivoEntregas: mocks.sha, prepararSaidaEntregas: mocks.prepararSaida, conferirGuardasEntregas: mocks.guardas, conferirCodigoEntregas: mocks.codigo }));
import { argumentosEntregasHistoricas, executarEntregasHistoricasCli } from "../../scripts/entregas-historicas-enriquecer";
import { hashCanonico } from "@/lib/vendas/historico-dominio";

const base = path.resolve(".tmp/entregas-cli-sintetico");
const fonteHash = "a".repeat(64), entradaHash = "b".repeat(64), guardasHash = "c".repeat(64), previaHash = "d".repeat(64), token = "e".repeat(64);
const lote = "entregas-sinteticas-20261015";
const args = (modo = "previa") => [
  `--modo=${modo}`, `--fonte=${path.join(base, "fonte.json")}`, `--fonte-sha256=${fonteHash}`,
  `--guardas=${path.join(base, "guardas.json")}`, `--guardas-sha256=${guardasHash}`, "--usuario-id=admin-sintetico", "--sessao-versao=0", `--lote=${lote}`, `--saida=${path.join(base, "saida")}`,
  ...(modo === "aplicar" || modo === "reverter" ? [`--previa=${path.join(base, "previa.json")}`, `--previa-sha256=${previaHash}`, `--verificacoes=${path.join(base, "verificacoes.json")}`, `--publicacao=${path.join(base, "publicacao.json")}`, `--revisao=${"f".repeat(40)}`] : []),
];
const backup = { versao: 1, loteId: lote, entradaSha256: entradaHash, linhas: [] };
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs();
  mocks.fonte.mockImplementation(v => v); mocks.entradaHash.mockReturnValue(entradaHash);
  mocks.guardas.mockResolvedValue({ backupHubSha256: "1".repeat(64), validacaoDumpSha256: "2".repeat(64), baselineSha256: "3".repeat(64), conferenciaSha256: entradaHash });
  mocks.prepararSaida.mockResolvedValue(mocks.liberar); mocks.sha.mockResolvedValue({ sha256: "9".repeat(64), bytes: 2000 });
  mocks.ler.mockImplementation(async (arquivo: string) => arquivo.endsWith("fonte.json") ? { conteudo: { versao: 1 }, sha256: fonteHash }
    : arquivo.endsWith("previa.json") ? { conteudo: { modo: "previa", loteId: lote, entradaSha256: entradaHash, token, backupMetadados: backup }, sha256: previaHash }
    : { conteudo: backup, sha256: "9".repeat(64) });
  mocks.preparar.mockResolvedValue({ token, entradaSha256: entradaHash, backupMetadados: backup });
  mocks.aplicar.mockResolvedValue({ aplicados: 0 });
});

describe("CLI de metadados históricos de entrega", () => {
  it.each(["previa", "planejar", "aplicar", "previa-reversao", "reverter"])("aceita o modo %s sem alterar IDs de auditoria", modo => {
    expect(argumentosEntregasHistoricas(args(modo))).toMatchObject({ modo: modo === "planejar" ? "previa" : modo, lote, usuario: "admin-sintetico", versao: 0 });
  });
  it.each(["--fonte-sha256=", "--modo", "--EXTRA=x", "--usuario-id=outro", "--desconhecido=x"])("recusa argumento incompleto, desconhecido ou duplicado: %s", extra => {
    expect(() => argumentosEntregasHistoricas([...args(), extra])).toThrow("ENTREGAS_HISTORICAS_CLI_ARGUMENTOS_INVALIDOS");
  });
  it("exige fonte e plano imutáveis nas mutações", () => {
    expect(() => argumentosEntregasHistoricas(args().filter(v => !v.startsWith("--fonte-sha256=")))).toThrow(/ARGUMENTO_AUSENTE/u);
    expect(() => argumentosEntregasHistoricas(args("aplicar").filter(v => !v.startsWith("--previa-sha256=")))).toThrow(/ARGUMENTO_AUSENTE/u);
    expect(() => argumentosEntregasHistoricas(args().map(v => v.startsWith("--fonte-sha256=") ? "--fonte-sha256=invalido" : v))).toThrow(/HASH_INVALIDO/u);
  });
  it("aceita consulta postal somente com o hash físico correspondente", () => {
    expect(() => argumentosEntregasHistoricas([...args(), `--postal=${path.join(base, "postal.json")}`])).toThrow(/POSTAL_INCOMPLETO/u);
    expect(argumentosEntregasHistoricas([...args(), `--postal=${path.join(base, "postal.json")}`, `--postal-sha256=${"6".repeat(64)}`]).args.has("postal")).toBe(true);
  });
  it("a prévia não chama aplicação e seu log contém apenas metadados do arquivo", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await executarEntregasHistoricasCli(args());
      expect(mocks.preparar).toHaveBeenCalledTimes(1); expect(mocks.aplicar).not.toHaveBeenCalled(); expect(mocks.reverter).not.toHaveBeenCalled();
      expect(mocks.salvar.mock.calls[0][1]).toMatchObject({ modo: "previa", fonteSha256: fonteHash, entradaSha256: entradaHash });
      expect(String(log.mock.calls[0][0])).not.toContain("backupMetadados"); expect(mocks.liberar).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });
  it("não aplica sem a autorização operacional explícita", async () => {
    await expect(executarEntregasHistoricasCli(args("aplicar"))).rejects.toThrow(/AUTORIZACAO_EXIGIDA/u);
    expect(mocks.aplicar).not.toHaveBeenCalled(); expect(mocks.salvar).not.toHaveBeenCalled();
  });
  it("recusa uma fonte alterada antes de consultar o banco ou validar guardas", async () => {
    mocks.ler.mockResolvedValueOnce({ conteudo: { versao: 1 }, sha256: "0".repeat(64) });
    await expect(executarEntregasHistoricasCli(args())).rejects.toThrow(/FONTE_DIVERGENTE/u);
    expect(mocks.guardas).not.toHaveBeenCalled(); expect(mocks.preparar).not.toHaveBeenCalled();
  });
  it("persiste e relê o backup da chave antes de aplicar, após validar o código", async () => {
    vi.stubEnv("ENTREGAS_HISTORICAS_AUTORIZADAS", "SIM");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await executarEntregasHistoricasCli(args("aplicar"));
      expect(mocks.codigo).toHaveBeenCalledTimes(1);
      expect(mocks.salvar.mock.calls[0][0]).toContain("backup-metadados-"); expect(mocks.salvar.mock.calls[0][1]).toEqual(backup);
      expect(mocks.salvar.mock.invocationCallOrder[0]).toBeLessThan(mocks.aplicar.mock.invocationCallOrder[0]);
      expect(mocks.aplicar.mock.calls[0][0]).toMatchObject({ tokenPrevia: token, backupMetadadosSha256: hashCanonico(backup), usuarioId: "admin-sintetico", sessaoVersao: 0 });
    } finally { log.mockRestore(); }
  });
  it("recusa plano alterado antes de escrever o backup ou chamar o serviço", async () => {
    vi.stubEnv("ENTREGAS_HISTORICAS_AUTORIZADAS", "SIM");
    const anterior = mocks.ler.getMockImplementation()!;
    mocks.ler.mockImplementation(async arquivo => arquivo.endsWith("previa.json") ? { ...(await anterior(arquivo)), sha256: "0".repeat(64) } : anterior(arquivo));
    await expect(executarEntregasHistoricasCli(args("aplicar"))).rejects.toThrow(/PREVIA_DIVERGENTE/u);
    expect(mocks.aplicar).not.toHaveBeenCalled(); expect(mocks.salvar).not.toHaveBeenCalled(); expect(mocks.liberar).toHaveBeenCalledTimes(1);
  });
  it("a reversão exige sua própria prévia e não aceita um plano de aplicação", async () => {
    vi.stubEnv("ENTREGAS_HISTORICAS_AUTORIZADAS", "SIM");
    await expect(executarEntregasHistoricasCli(args("reverter"))).rejects.toThrow(/PREVIA_DIVERGENTE/u);
    expect(mocks.reverter).not.toHaveBeenCalled();
  });
});
