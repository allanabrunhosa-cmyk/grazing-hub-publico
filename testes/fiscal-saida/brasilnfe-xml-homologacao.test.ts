import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { conferirXmlHomologacaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/xml-homologacao";
const esperado = { total: "10.00", quantidadeItens: 1, ipiOmitido: true };
const xml = '<nfeProc><NFe><infNFe><det nItem="1"><imposto><ICMS/></imposto></det><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';
describe("XML confrontado com condições originais do manifesto sintético", () => {
  it("aceita total e itens correspondentes, sem nova apuração ou destaque inventado", () => { expect(() => conferirXmlHomologacaoBrasilNfe(xml, esperado)).not.toThrow(); });
  it.each([xml.replace("10.00", "10.01"), xml.replace("10.00", "1e1"), xml.replace("10.00", "TOKEN_FICTICIO"), xml.replace('<ICMS/>', '<ICMS/><IPI><IPINT><CST>53</CST></IPINT></IPI>'), xml.replace('nItem="1"', 'nItem="2"'), '<!DOCTYPE x>'+xml])("rejeita divergência sem exibir XML ou texto externo", v => {
    try { conferirXmlHomologacaoBrasilNfe(v, esperado); throw new Error("Deveria rejeitar."); } catch (e) { expect(String(e)).toContain("não corresponde"); expect(String(e)).not.toContain("TOKEN_FICTICIO"); expect(String(e)).not.toContain("<"); }
  });
  it("metadado ausente ou quantidade divergente não vira sucesso", () => { expect(() => conferirXmlHomologacaoBrasilNfe(xml, null)).toThrow(); expect(() => conferirXmlHomologacaoBrasilNfe(xml, { ...esperado, quantidadeItens: 2 })).toThrow(); });
});
