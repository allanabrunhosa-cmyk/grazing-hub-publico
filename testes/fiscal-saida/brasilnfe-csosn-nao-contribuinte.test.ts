import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { pendenciaCsosnNaoContribuinte } from "@/lib/fiscal-saida/brasilnfe/csosn-nao-contribuinte";
import { prepararPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { validarSnapshotBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
const entrada = { modelo: 55, crt: 1, finalidade: 1, indicadorIe: 9, cfop: 5102, csosn: "900", indice: 2, nome: "Produto exclusivamente sintético" };
describe("N12a-70: campo e item antes da transmissão", () => {
  it("indica posição, produto e CSOSN sem substituir o código", () => {
    expect(pendenciaCsosnNaoContribuinte(entrada)).toContain("Item fiscal 3 — Produto exclusivamente sintético: CSOSN 900");
    expect(pendenciaCsosnNaoContribuinte(entrada)).toContain("SEFAZ 600"); expect(entrada.csosn).toBe("900");
  });
  it.each(["102", "103", "300", "400", "500"])("preserva CSOSN permitido %s", csosn => {
    expect(pendenciaCsosnNaoContribuinte({ ...entrada, csosn })).toBeNull();
  });
  it.each([{ modelo: 65 }, { indicadorIe: 1 }, { crt: 3 }, { crt: 4 }, { finalidade: 4 }])("não amplia o alcance da regra para %j", contexto => {
    expect(pendenciaCsosnNaoContribuinte({ ...entrada, ...contexto })).toBeNull();
  });
  it.each([5915, 5916, 6915, 6916, 5912, 5913])("preserva a exceção do CFOP %s", cfop => {
    expect(pendenciaCsosnNaoContribuinte({ ...entrada, cfop })).toBeNull();
  });
  it("validador final recusa snapshot NF-e incompatível, sem afetar NFC-e", () => {
    const m = massaPayloadLocal(), r = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros);
    const documento = structuredClone(r.payload!);
    documento.Cliente = { ...documento.Cliente!, IndicadorIe: 9 };
    documento.Produtos[0].Imposto.ICMS.CodSituacaoTributaria = "900";
    const snapshot = { schema: "grazing.fiscal-saida", versao: 2, valores: m.documento.payload.valores,
      tributacao: { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, crt: 1, documento } };
    expect(() => validarSnapshotBrasilNfe(snapshot, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" })).toThrow(/Produto 1.*CSOSN 900.*SEFAZ 600/);
    documento.ModeloDocumento = 65;
    expect(() => validarSnapshotBrasilNfe(snapshot, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" })).not.toThrow();
  });
});
