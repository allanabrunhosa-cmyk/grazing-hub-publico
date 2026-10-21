import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { conferirFciFiscal, validarDecisaoFciFiscal } from "@/lib/tributacao/fci";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import { hashFiscal } from "@/lib/tributacao/servico";
import { prepararPayloadLocalBrasilNfe, prepararPayloadSnapshotBrasilNfeLocal, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { massaPayloadLocal } from "../fiscal-saida/brasilnfe-payload-local-fixtures";
import type { DecisaoFciFiscal } from "@/lib/tributacao/tipos";
import { conferirFciXmlBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/arquivos";
const numero = "ABCDE123-ABCD-1234-ABCD-1234567890AB";
const contexto = { data: "2026-10-14", ufEmitente: "SP", ufDestino: "SP", modelo: "55" as const };
/** Todos os valores e provas abaixo são fictícios; não classificam mercadoria real. */
function decisao(extra: Partial<DecisaoFciFiscal> = {}): DecisaoFciFiscal {
  return { situacao: "EXIGIDA", numero, periodoApuracao: "2026-08", conteudoImportacao: "20", valorParcelaImportada: "2", valorSaidaReferencia: "10", apuracaoCompleta: true, justificativa: "Caso exclusivamente sintético para testar campos e bloqueios", fontes: ["https://legislacao.fazenda.sp.gov.br/Paginas/pcat642013.aspx"], evidencias: ["COMPROVANTE-FCI-SOMENTE-TESTE"], ...extra };
}
describe("FCI versionada, sem gerar ficha ou apurar valores a partir do preço comercial", () => {
  it("versões históricas sem campo FCI mantêm estrutura e hash", () => {
    const antigo = { produtoId: "produto-ficticio", grupo: "GF01", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: "0", cest: null, unidade: "UN", estado: "CONFIRMADO", evidencias: ["Fonte sintética"], pendencias: [] };
    const validado = validarDadosFiscais("CLASSIFICACAO", antigo); expect(validado).toEqual(antigo); expect(validado).not.toHaveProperty("fci"); expect(hashFiscal(validado)).toBe(hashFiscal(antigo));
    expect(conferirFciFiscal("0", undefined, contexto)).toEqual({ numero: null, pendencias: [] });
  });
  it.each(["3", "5", "8"])("origem%s sem decisão documentada fica pendente; não cria UUID", origem => {
    const r = conferirFciFiscal(origem, undefined, contexto); expect(r.numero).toBeNull(); expect(r.pendencias[0]).toContain("apuração normativa");
  });
  it.each(["inválido", "b01f70af-10bf-4b1f-848c-65ff57f616fe", "00000000-0000-0000-0000-000000000000", `${numero}\n`, `${numero}-X`])("recusa controle não conforme ao leiaute oficial: %s", invalido => {
    expect(() => validarDecisaoFciFiscal(decisao({ numero: invalido }))).toThrow("FCI");
  });
  it("preserva prova parcial sem marcar CI ou origem como resolvidos", () => {
    const d = validarDecisaoFciFiscal(decisao({ situacao: "PENDENTE", numero: null, conteudoImportacao: null, valorParcelaImportada: "3.1725", valorSaidaReferencia: null, apuracaoCompleta: false }));
    expect(d.valorParcelaImportada).toBe("3.1725"); expect(d.conteudoImportacao).toBeNull();
    const r = conferirFciFiscal("5", d, contexto); expect(r.numero).toBeNull(); expect(r.pendencias.join(" ")).toContain("Custo parcial ou preço do pedido não substituem");
  });
  it("exigir FCI sem número oficial bloqueia a operação mesmo com apuração completa", () => {
    expect(conferirFciFiscal("5", decisao({ numero: null }), contexto).pendencias.join(" ")).toContain("número de controle recebido");
  });
  it.each([["5", "40", "4"], ["3", "40.0001", "4.00001"], ["3", "70", "7"], ["8", "70.0001", "7.00001"]])("respeita fronteira exata origem%s/CI%s sem arredondar a classificação", (origem, ci, vi) => {
    expect(conferirFciFiscal(origem, decisao({ conteudoImportacao: ci, valorParcelaImportada: vi }), contexto)).toEqual({ numero, pendencias: [] });
  });
  it("origem, período e proporção incompatíveis não viram sucesso", () => {
    expect(conferirFciFiscal("0", decisao(), contexto).pendencias.join(" ")).toContain("incompatíveis");
    expect(conferirFciFiscal("3", decisao(), contexto).numero).toBeNull();
    expect(conferirFciFiscal("5", decisao({ periodoApuracao: "2026-11" }), contexto).pendencias.join(" ")).toContain("posterior");
    expect(() => validarDecisaoFciFiscal(decisao({ conteudoImportacao: "21" }))).toThrow("coerência");
    const fronteira = decisao({ conteudoImportacao: "40", valorParcelaImportada: "4.000001" });
    expect(conferirFciFiscal("5", fronteira, contexto).pendencias.join(" ")).toContain("não arredondar a classificação");
  });
  it("dispensa fundamentada não vale para outro destino ou modelo", () => {
    const d = decisao({ situacao: "DISPENSADA_COM_FUNDAMENTO", numero: null, dispensa: { ufEmitente: "SP", ufDestino: "SP", modelos: ["55"] } });
    expect(conferirFciFiscal("5", d, contexto)).toEqual({ numero: null, pendencias: [] });
    expect(conferirFciFiscal("5", d, { ...contexto, ufDestino: "MG" }).pendencias.join(" ")).toContain("não abrange");
    expect(conferirFciFiscal("5", d, { ...contexto, modelo: "65" }).numero).toBeNull();
    expect(() => validarDecisaoFciFiscal({ ...d, dispensa: undefined })).toThrow("dispensa");
    expect(() => validarDecisaoFciFiscal({ ...d, fontes: ["https://example.invalid/fonte"] })).toThrow("fonte oficial");
    expect(() => validarDecisaoFciFiscal({ ...d, dispensa: { ...d.dispensa, ufDestino: "ZZ" } })).toThrow("alcance");
  });
  it("dados e campos inesperados não são conservados em um diagnóstico livre", () => {
    for (const extra of [{ Token: "segredo-ficticio" }, { UserToken: "segredo-ficticio" }, { causa: "detalhe-ficticio" }, { valorSaidaReferencia: "NaN" }, { conteudoImportacao: "100.0001" }]) expect(() => validarDecisaoFciFiscal({ ...decisao(), ...extra })).toThrow();
  });
  it.each([55, 65] as const)("modelo%s fotografa e envia somente Produtos[].nFCI documentado, sem metadados normativos no wire", modelo => {
    const m = massaPayloadLocal(), base = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros);
    const payload = structuredClone(base.payload!); payload.Produtos[0].OrigemProduto = 5; payload.Produtos[0].nFCI = numero;
    const fotografia = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, emitenteUf: "SP", crt: 1, documento: payload, previa: { contexto: { data: contexto.data, ufDestino: "SP" }, linhas: [{ produtoId: payload.Produtos[0].CodProdutoServico, fci: decisao() }] } } } };
    const r = prepararPayloadSnapshotBrasilNfeLocal(fotografia, modelo, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" });
    const corpo = JSON.parse(serializarPayloadLocalBrasilNfe(r)); expect(corpo.Produtos[0].nFCI).toBe(numero); expect(corpo.Produtos[0]).not.toHaveProperty("NumeroFCI"); expect(JSON.stringify(corpo)).not.toMatch(/valorParcelaImportada|apuracaoCompleta|COMPROVANTE-FCI/);
    fotografia.payload.tributacao.documento.Produtos[0].nFCI = "A01F70AF-10BF-4B1F-848C-65FF57F616FE";
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(fotografia, modelo, { cnpj: m.cadastro.cnpj, ambiente: "HOMOLOGACAO" })).toThrow("FCI");
  });
  it("payload legado com origem dependente de CI não contorna o motor e a revisão novos", () => {
    const m = massaPayloadLocal(); m.documento.payload.itens[0].fiscal.produto.origem = "5";
    const r = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros);
    expect(r.montagemConcluida).toBe(false); expect(r.payload).toBeNull(); expect(r.pendencias.some(p => p.campo.endsWith(".nFCI"))).toBe(true);
  });
  it("XML autorizado deve conservar nFCI no produto e item fotografados", () => {
    const produtos = [{ CodProdutoServico: "produto-ficticio", nFCI: numero }];
    const xml = `<nfeProc><NFe><infNFe><det nItem="1"><prod><cProd>produto-ficticio</cProd><nFCI>${numero}</nFCI></prod></det></infNFe></NFe></nfeProc>`;
    expect(() => conferirFciXmlBrasilNfe(xml, produtos)).not.toThrow();
    for (const divergente of [xml.replace(`<nFCI>${numero}</nFCI>`, ""), xml.replace(numero, "12345678-ABCD-1234-ABCD-1234567890AB"), xml.replace("produto-ficticio", "outro-produto-ficticio"), xml.replace('nItem="1"', 'nItem="2"')]) expect(() => conferirFciXmlBrasilNfe(divergente, produtos)).toThrow();
    expect(() => conferirFciXmlBrasilNfe("<!DOCTYPE nfeProc><nfeProc/>", produtos)).toThrow();
  });
});
