import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  notaFiscalRecebida: { findUnique: vi.fn(), update: vi.fn() },
  manifestacaoNFe: { create: vi.fn() },
} }));
vi.mock("@/lib/sefaz/certificado", () => ({ obterCnpjConsulta: vi.fn() }));
vi.mock("@/lib/sefaz/evento", () => ({ enviarManifestacao: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { obterCnpjConsulta } from "@/lib/sefaz/certificado";
import { enviarManifestacao } from "@/lib/sefaz/evento";
import { manifestarNotaFiscal } from "@/lib/sefaz/manifestar";
import { categoriaDaNota } from "@/app/(protegido)/notas-fiscais/types";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.notaFiscalRecebida.findUnique).mockResolvedValue({
    id: "nota-teste", ultimaManifestacao: null, cienciaJaExistenteEm: null, manifestacoes: [],
  } as never);
  vi.mocked(obterCnpjConsulta).mockResolvedValue("00000000000000");
  vi.mocked(enviarManifestacao).mockResolvedValue({ sucesso: true, cStat: "135", xMotivo: "Registrado", protocolo: "123" });
});

describe("registro da manifestação", () => {
  it.each(["CIENCIA_DA_OPERACAO", "CONFIRMACAO_DA_OPERACAO", "DESCONHECIMENTO_DA_OPERACAO", "OPERACAO_NAO_REALIZADA"] as const)("sempre usa sequência 1 para %s", async (tipo) => {
    vi.mocked(prisma.notaFiscalRecebida.findUnique).mockResolvedValue({ id: "nota", manifestacoes: [
      { tipo: "CONFIRMACAO_DA_OPERACAO", sucesso: false }, { tipo: "CIENCIA_DA_OPERACAO", sucesso: true },
    ] } as never);
    await manifestarNotaFiscal("0".repeat(44), tipo, "Mercadoria não foi entregue.");
    expect(enviarManifestacao).toHaveBeenCalledWith(expect.objectContaining({ tipo, nSeqEvento: 1 }));
  });
  it.each(["CONFIRMACAO_DA_OPERACAO", "DESCONHECIMENTO_DA_OPERACAO", "OPERACAO_NAO_REALIZADA"] as const)("salva %s somente após aceite da SEFAZ", async (tipo) => {
    expect((await manifestarNotaFiscal("0".repeat(44), tipo, "  Mercadoria não foi entregue.  ")).sucesso).toBe(true);
    expect(prisma.manifestacaoNFe.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo, sucesso: true, protocolo: "123" }) });
    expect(prisma.notaFiscalRecebida.update).toHaveBeenCalledWith({ where: { id: "nota-teste" }, data: { ultimaManifestacao: tipo } });
    if (tipo === "OPERACAO_NAO_REALIZADA") expect(enviarManifestacao).toHaveBeenCalledWith(expect.objectContaining({ justificativa: "Mercadoria não foi entregue." }));
  });
  it("reconhece nova duplicidade de confirmação como evento já registrado", async () => {
    vi.mocked(enviarManifestacao).mockResolvedValue({ sucesso: false, cStat: "573", xMotivo: "Duplicidade", protocolo: null });
    expect(await manifestarNotaFiscal("0".repeat(44), "CONFIRMACAO_DA_OPERACAO")).toMatchObject({
      sucesso: true, mensagem: expect.stringContaining("já registrado"), protocolo: null,
    });
    expect(prisma.notaFiscalRecebida.update).toHaveBeenCalledWith({
      where: { id: "nota-teste" }, data: { ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" },
    });
    expect(prisma.manifestacaoNFe.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sucesso: false, cStat: "573" }) });
  });
  it("recupera duplicidade definitiva já registrada sem chamar novamente a SEFAZ", async () => {
    vi.mocked(prisma.notaFiscalRecebida.findUnique).mockResolvedValue({
      id: "nota-teste", ultimaManifestacao: null, cienciaJaExistenteEm: null,
      manifestacoes: [{ tipo: "CONFIRMACAO_DA_OPERACAO", sucesso: false, cStat: "573" }],
    } as never);
    expect(await manifestarNotaFiscal("0".repeat(44), "CONFIRMACAO_DA_OPERACAO")).toMatchObject({
      sucesso: true, mensagem: expect.stringContaining("status local foi recuperado"), protocolo: null,
    });
    expect(enviarManifestacao).not.toHaveBeenCalled();
    expect(prisma.manifestacaoNFe.create).not.toHaveBeenCalled();
    expect(prisma.notaFiscalRecebida.update).toHaveBeenCalledWith({
      where: { id: "nota-teste" }, data: { ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" },
    });
  });
  it("Ciência 573 evita reenvio sem inventar protocolo nem aceitar a nota", async () => {
    vi.mocked(enviarManifestacao).mockResolvedValue({ sucesso: false, cStat: "573", xMotivo: "Duplicidade", protocolo: null });
    expect(await manifestarNotaFiscal("0".repeat(44), "CIENCIA_DA_OPERACAO")).toMatchObject({ sucesso: false, protocolo: null });
    expect(prisma.notaFiscalRecebida.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "nota-teste" }, data: { cienciaJaExistenteEm: expect.any(Date) } });
  });
  it("preserva o erro conhecido no histórico e mantém a nota pendente", async () => {
    const mensagem = "Object reference not set to an instance of an object";
    vi.mocked(enviarManifestacao).mockRejectedValue(new Error(mensagem));
    expect(await manifestarNotaFiscal("0".repeat(44), "CONFIRMACAO_DA_OPERACAO")).toEqual({ sucesso: false, mensagem, protocolo: null });
    expect(prisma.notaFiscalRecebida.update).not.toHaveBeenCalled();
    expect(prisma.manifestacaoNFe.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sucesso: false, xMotivo: mensagem }) });
  });
  it("retorna falha de certificado no mesmo contrato da ação", async () => {
    vi.mocked(obterCnpjConsulta).mockRejectedValue(new Error("Certificado indisponível"));
    expect(await manifestarNotaFiscal("0".repeat(44), "CONFIRMACAO_DA_OPERACAO")).toMatchObject({ sucesso: false, mensagem: "Certificado indisponível" });
    expect(enviarManifestacao).not.toHaveBeenCalled();
  });
  it.each(["", "curta", " ".repeat(20), "a".repeat(256)])("recusa justificativa inválida antes de acessar a SEFAZ (%s)", async (justificativa) => {
    expect((await manifestarNotaFiscal("0".repeat(44), "OPERACAO_NAO_REALIZADA", justificativa)).sucesso).toBe(false);
    expect(prisma.notaFiscalRecebida.findUnique).not.toHaveBeenCalled();
    expect(enviarManifestacao).not.toHaveBeenCalled();
  });
  it("não envia nota inexistente", async () => {
    vi.mocked(prisma.notaFiscalRecebida.findUnique).mockResolvedValue(null);
    expect((await manifestarNotaFiscal("0".repeat(44), "CONFIRMACAO_DA_OPERACAO")).sucesso).toBe(false);
    expect(enviarManifestacao).not.toHaveBeenCalled();
  });
  it("agrupa as duas recusas e mantém ciência como pendente", () => {
    expect(categoriaDaNota("OPERACAO_NAO_REALIZADA")).toBe("RECUSADA");
    expect(categoriaDaNota("DESCONHECIMENTO_DA_OPERACAO")).toBe("RECUSADA");
    expect(categoriaDaNota("CIENCIA_DA_OPERACAO")).toBe("PENDENTE");
    expect(categoriaDaNota(null)).toBe("PENDENTE");
  });
});
