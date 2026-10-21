import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { conferirTotaisDocumentoXmlBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/conferencia-totais-xml";
import type { DocumentoBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-contrato";
const nomeHomologacao55 = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";
function massa(modelo: 55 | 65 = 55, ambiente: 1 | 2 = 2) {
  const documento: DocumentoBrasilNfe = { ModeloDocumento: modelo, TipoAmbiente: ambiente, NaturezaOperacao: "Cenário exclusivamente sintético", Finalidade: 1, IndicadorPresenca: 1, ConsumidorFinal: true, Cliente: { CpfCnpj: "00000000000", NmCliente: modelo === 55 && ambiente === 2 ? nomeHomologacao55 : "Nome exclusivamente sintético", IndicadorIe: 9 }, Produtos: [{ CodProdutoServico: "produto-ficticio", NmProduto: "Produto sintético", NCM: "19059090", CFOP: 5101, OrigemProduto: 5, EAN: "SEM GTIN", UnidadeComercial: "UN", UnidadeComercialTributavel: "UN", Quantidade: "2", QuantidadeTributavel: "2", ValorUnitario: "37.50", ValorUnitarioTributavel: "37.5000000000", ValorTotal: "75.00", ValorFrete: "12.00", ValorDesconto: "5.00", ValorOutrasDespesas: "3.00", Imposto: { ICMS: { CodSituacaoTributaria: "102" }, PIS: { CodSituacaoTributaria: "49" }, COFINS: { CodSituacaoTributaria: "49" } } }], Pagamentos: [], ValorTotal: "85.00" };
  const xml = `<nfeProc><NFe><infNFe><ide><mod>${modelo}</mod><tpAmb>${ambiente}</tpAmb></ide><dest><xNome>${documento.Cliente!.NmCliente}</xNome></dest><det nItem="1"><prod><cProd>produto-ficticio</cProd><NCM>19059090</NCM><CFOP>5101</CFOP><uCom>UN</uCom><uTrib>UN</uTrib><qCom>2.0000</qCom><qTrib>2.0000</qTrib><vUnCom>37.5000000000</vUnCom><vUnTrib>37.5000000000</vUnTrib><vProd>75.00</vProd><vFrete>12.00</vFrete><vDesc>5.00</vDesc><vOutro>3.00</vOutro></prod><imposto><ICMS><ICMSSN102><orig>5</orig></ICMSSN102></ICMS></imposto></det><total><ICMSTot><vNF>85.00</vNF><vProd>75.00</vProd><vFrete>12.00</vFrete><vDesc>5.00</vDesc><vOutro>3.00</vOutro><vSeg>0.00</vSeg></ICMSTot></total></infNFe></NFe></nfeProc>`;
  return { documento, xml };
}
describe("XML confere a montagem fiscal selada sem usar texto externo em erros", () => {
  it.each([[55, 2], [55, 1], [65, 2], [65, 1]] as const)("confere modelo %s ambiente %s, valores exatos e ausência de FCI", (modelo, ambiente) => { const m = massa(modelo, ambiente); expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml, m.documento)).not.toThrow(); });
  it("normaliza apenas zeros insignificantes do snapshot e mantém a precisão XML", () => {
    const m = massa(); m.documento.Produtos[0] = { ...m.documento.Produtos[0], Quantidade: "1.000000", QuantidadeTributavel: "1.000000", ValorUnitario: "75.0000000000", ValorUnitarioTributavel: "75.0000000000" };
    const xml = m.xml.replaceAll("2.0000", "1.0000").replaceAll("37.5000000000", "75.0000000000");
    expect(() => conferirTotaisDocumentoXmlBrasilNfe(xml, m.documento)).not.toThrow();
    m.documento.Produtos[0].Quantidade = "1.000001"; expect(() => conferirTotaisDocumentoXmlBrasilNfe(xml, m.documento)).toThrow();
    m.documento.Produtos[0].Quantidade = "1.000000"; expect(() => conferirTotaisDocumentoXmlBrasilNfe(xml.replace("<qCom>1.0000</qCom>", "<qCom>1.000000</qCom>"), m.documento)).toThrow();
  });
  it.each(["vNF", "vProd", "vFrete", "vDesc", "vOutro", "vSeg", "qCom", "qTrib", "vUnCom", "vUnTrib"])("recusa divergência em %s", campo => {
    const m = massa(), xml = m.xml.replace(new RegExp(`<${campo}>[^<]*</${campo}>`), `<${campo}>999.00</${campo}>`);
    expect(() => conferirTotaisDocumentoXmlBrasilNfe(xml, m.documento)).toThrow("diverge");
  });
  it.each([["NCM", "99999999"], ["CFOP", "6101"], ["orig", "0"], ["cProd", "outro-produto"], ["uCom", "KG"], ["uTrib", "KG"]])("recusa mudança em %s", (campo, valor) => { const m = massa(); expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml.replace(new RegExp(`<${campo}>[^<]*</${campo}>`), `<${campo}>${valor}</${campo}>`), m.documento)).toThrow("diverge"); });
  it("não aceita FCI acrescentada pelo fornecedor nem desaparecimento de FCI enviada", () => {
    const m = massa(), nFCI = "12345678-1234-1234-1234-123456789012";
    expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml.replace("</prod>", `<nFCI>${nFCI}</nFCI></prod>`), m.documento)).toThrow("diverge");
    m.documento.Produtos[0].nFCI = nFCI; expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml, m.documento)).toThrow("diverge");
    expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml.replace("</prod>", `<nFCI>${nFCI}</nFCI></prod>`), m.documento)).not.toThrow();
  });
  it("literal de homologação55 pertence à montagem e ao XML", () => {
    const m = massa(); expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml.replace(nomeHomologacao55, "Nome diferente"), m.documento)).toThrow("diverge");
    m.documento.Cliente!.NmCliente = "Nome diferente"; expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml, m.documento)).toThrow("diverge");
  });
  it.each([{ caso: "HTML", xml: "<html>erro sensível externo</html>" }, { caso: "entidade", xml: "<!DOCTYPE nfeProc [<!ENTITY x SYSTEM 'file:///segredo'>]><nfeProc>&x;</nfeProc>" }, { caso: "quebrado", xml: "<nfeProc>" }, { caso: "excessivo", xml: "x".repeat(2 * 1024 * 1024 + 1) }])("recusa conteúdo $caso sem conservar o texto", ({ xml }) => {
    const m = massa(); try { conferirTotaisDocumentoXmlBrasilNfe(xml, m.documento); throw new Error("Falha esperada"); } catch (e) { expect(e).toHaveProperty("name", "ErroConferenciaXmlBrasilNfe"); expect(String(e)).not.toContain("sensível"); expect(String(e)).not.toContain("segredo"); }
  });
  it("recusa itens ausentes/duplicados, posições trocadas e totais sem prova", () => {
    const m = massa(); expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml.replace('nItem="1"', 'nItem="2"'), m.documento)).toThrow();
    expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml, { ...m.documento, Produtos: [] })).toThrow();
    expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml, { ...m.documento, Produtos: Array.from({ length: 991 }, () => m.documento.Produtos[0]) })).toThrow();
    expect(() => conferirTotaisDocumentoXmlBrasilNfe(m.xml.replace("<vSeg>0.00</vSeg>", ""), m.documento)).toThrow();
  });
});
