import { beforeEach, describe, expect, it, vi } from "vitest";

const simulacao = vi.hoisted(() => ({
  listar: vi.fn(), reler: vi.fn(), trava: vi.fn(), transacao: vi.fn(), manifestar: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  notaFiscalRecebida: { findMany: simulacao.listar }, $transaction: simulacao.transacao,
} }));
vi.mock("@/lib/sefaz/manifestar", () => ({ manifestarNotaFiscal: simulacao.manifestar }));
import { registrarCienciasPendentes } from "@/lib/sefaz/ciencia-automatica";

beforeEach(() => {
  vi.resetAllMocks();
  simulacao.listar.mockResolvedValue([{ id: "nota", chaveAcesso: "0".repeat(44) }]);
  simulacao.trava.mockResolvedValue([{ obtida: true }]);
  simulacao.reler.mockResolvedValue({ id: "nota" });
  simulacao.transacao.mockImplementation(async (executar) => executar({ $queryRaw: simulacao.trava, notaFiscalRecebida: { findFirst: simulacao.reler } }));
  simulacao.manifestar.mockResolvedValue({ sucesso: true });
});

describe("Ciência automática autorizada", () => {
  it("envia somente Ciência e exclui notas completas, manifestadas e tentativas recentes", async () => {
    expect(await registrarCienciasPendentes(10)).toEqual({ tentativas: 1, registradas: 1, falhas: [] });
    expect(simulacao.manifestar).toHaveBeenCalledExactlyOnceWith("0".repeat(44), "CIENCIA_DA_OPERACAO");
    expect(simulacao.listar).toHaveBeenCalledWith(expect.objectContaining({ take: 10, where: {
      xml: null, cienciaJaExistenteEm: null, ultimaManifestacao: null, manifestacoes: { none: { OR: [
        { sucesso: true }, { tipo: "CIENCIA_DA_OPERACAO", createdAt: { gte: expect.any(Date) } },
      ] } },
    } }));
  });
  it("relê a nota após a trava para evitar Ciência depois de uma decisão ou importação concorrente", async () => {
    simulacao.reler.mockResolvedValue(null);
    await registrarCienciasPendentes(10);
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("não concorre com aceite ou recusa", async () => {
    simulacao.trava.mockResolvedValue([{ obtida: false }]);
    await registrarCienciasPendentes(10);
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("reporta rejeição sem contabilizar registro e processa a próxima nota", async () => {
    simulacao.listar.mockResolvedValue([{ id: "a", chaveAcesso: "0".repeat(44) }, { id: "b", chaveAcesso: "1".repeat(44) }]);
    simulacao.manifestar.mockResolvedValueOnce({ sucesso: false, mensagem: "573 — Duplicidade" });
    const resultado = await registrarCienciasPendentes(10);
    expect(resultado).toMatchObject({ tentativas: 2, registradas: 1, falhas: [expect.stringContaining("573")] });
  });
  it("não consulta pendentes quando já atingiu o limite", async () => {
    expect(await registrarCienciasPendentes(0)).toMatchObject({ tentativas: 0 });
    expect(simulacao.listar).not.toHaveBeenCalled();
  });
});
