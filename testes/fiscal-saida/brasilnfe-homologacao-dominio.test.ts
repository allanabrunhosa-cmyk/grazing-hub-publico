import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { pendenciasHomologacaoBrasilNfe, validarComandoHomologacaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/homologacao";
import { preRequisitosBrasilNfeVazios } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
import { exigirBaseHomologacaoControlada } from "@/lib/fiscal-saida/brasilnfe/capacidade-homologacao";

describe("Entrada específica da homologação manual", () => {
  const entrada = { documentoId: "documento-sintetico", modelo: 55, ambiente: 2, hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), total: "10.00", autorizarUmaTransmissao: true };
  it("exige modelo, hashes, valor e ato explícito, sem aceitar produção, payload ou credenciais", () => {
    expect(validarComandoHomologacaoBrasilNfe(entrada)).toEqual(entrada);
    for (const alteracao of [{ ambiente: 1 }, { modelo: 57 }, { autorizarUmaTransmissao: false }, { total: 10 }, { total: "1e1" }, { hashSnapshot: "invalido" }, { token: "segredo-sintetico" }, { payload: {} }]) expect(() => validarComandoHomologacaoBrasilNfe({ ...entrada, ...alteracao })).toThrow();
  });
  it("CSC limita somente65; prova do painel não transforma status1 da API em sucesso", () => {
    const p = preRequisitosBrasilNfeVazios(1); p.empresaCorrespondente = true;
    p.evidenciaPainel = { origem: "PAINEL_BRASIL_NFE", observadoEm: "2026-10-12T15:00:00.000Z", registradoEm: "2026-10-12T15:00:00.000Z", servicoNfeNfceAtivo: true, homologacaoInformadaPeloUsuario: true, certificadoValidade: "2026-11-07", csc: { homologacao: { codigo: false, identificador: false }, producao: { codigo: false, identificador: false } } };
    expect(pendenciasHomologacaoBrasilNfe(p, 55, "2026-10-12")).toEqual([]);
    expect(pendenciasHomologacaoBrasilNfe(p, 65, "2026-10-12")).toEqual(["Conferir CSC e identificador de homologação da NFC-e."]);
    p.certificado.situacao = "EXPIRADO";
    expect(pendenciasHomologacaoBrasilNfe(p, 55, "2026-10-12").join()).toContain("certificado");
  });
  it("restringe ação manual à base exclusiva, sem ler ou imprimir segredos", () => {
    const antes = process.env.DATABASE_URL;
    try {
      for (const url of ["postgresql://inutil@servidor.externo:5432/producao", "postgresql://inutil@127.0.0.1:55449/outro", "invalido"]) { process.env.DATABASE_URL = url; expect(() => exigirBaseHomologacaoControlada()).toThrow(); }
      process.env.DATABASE_URL = "postgresql://sintetico:inutil@127.0.0.1:55449/admin_brasilnfe_m11"; expect(() => exigirBaseHomologacaoControlada()).not.toThrow();
    } finally { if (antes === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = antes; }
  });
});
