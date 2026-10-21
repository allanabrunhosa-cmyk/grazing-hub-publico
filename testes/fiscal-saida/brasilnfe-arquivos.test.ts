import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
vi.mock("server-only", () => ({}));
import { validarArquivosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/arquivos";
import { chaveFicticia, identidadeFicticia } from "./brasilnfe-fixtures";
const protocolo = "90071992547409930001";
const xmlFicticio = (modelo = 55) => `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chaveFicticia(modelo)}"><ide><mod>${modelo}</mod><tpAmb>2</tpAmb><serie>1</serie><nNF>123</nNF></ide><emit><CNPJ>${identidadeFicticia.emitenteCnpj}</CNPJ></emit></infNFe></NFe><protNFe><infProt><tpAmb>2</tpAmb><chNFe>${chaveFicticia(modelo)}</chNFe><nProt>${protocolo}</nProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;
const base64 = (v: string) => Buffer.from(v).toString("base64");
function pdfFicticio(paginas = 1) {
  const documento = new jsPDF();
  for (let n = 1; n <= paginas; n++) { if (n > 1) documento.addPage(); documento.text(`Documento sintetico de teste - pagina ${n}`, 15, 20); }
  return Buffer.from(documento.output("arraybuffer")).toString("base64");
}
describe("Arquivos fiscais Brasil NFe", () => {
  it.each([55, 65] as const)("valida XML sintético vinculado ao modelo %s e preserva protocolo", async modeloDocumento => {
    const r = await validarArquivosBrasilNfe({ Base64Xml: base64(xmlFicticio(modeloDocumento)), Base64File: pdfFicticio() }, { identidade: { ...identidadeFicticia, modeloDocumento }, chave: chaveFicticia(modeloDocumento), protocolo });
    expect(r.xml).toContain(protocolo); expect(Buffer.from(r.pdf!).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("nunca guarda HTML da NFC-e como PDF", async () => {
    await expect(validarArquivosBrasilNfe({ Base64File: base64("<!DOCTYPE html><html>Representação fictícia</html>") }, { identidade: { ...identidadeFicticia, modeloDocumento: 65 }, chave: chaveFicticia(65), protocolo })).rejects.toThrow("HTML");
  });
  it.each(["<html>Erro externo</html>", "<!DOCTYPE nfeProc [<!ENTITY x SYSTEM 'file:///segredo'>]><nfeProc>&x;</nfeProc>", "<nfeProc>", xmlFicticio().replace("<tpAmb>2</tpAmb>", "<tpAmb>1</tpAmb>")])("rejeita HTML, entidades, XML quebrado e ambiente divergente", async conteudo => {
    await expect(validarArquivosBrasilNfe({ Base64Xml: base64(conteudo) }, { identidade: identidadeFicticia, chave: chaveFicticia(), protocolo })).rejects.toThrow("inválido");
  });
  it("rejeita Base64 malformado, arquivo excessivo e PDF incompleto", async () => {
    const contexto = { identidade: identidadeFicticia, chave: chaveFicticia(), protocolo };
    await expect(validarArquivosBrasilNfe({ Base64Xml: "%%%%" }, contexto)).rejects.toThrow("inválido");
    await expect(validarArquivosBrasilNfe({ Base64Xml: base64("x".repeat(2 * 1024 * 1024 + 1)) }, contexto)).rejects.toThrow("inválido");
    await expect(validarArquivosBrasilNfe({ Base64File: base64("%PDF-1.4\nIncompleto") }, contexto)).rejects.toThrow("inválido");
    await expect(validarArquivosBrasilNfe({ Base64Xml: base64(xmlFicticio()) }, { ...contexto, protocolo: "123" })).rejects.toThrow("divergente");
  });
  it.each(["%PDF-1.4\n<html>erro externo fictício</html>\n%%EOF", "%PDF-1.4\nARQUIVO_FICTICIO\n%%EOF"])("rejeita conteúdo disfarçado com cabeçalho e EOF de PDF", async conteudo => {
    await expect(validarArquivosBrasilNfe({ Base64File: base64(conteudo) }, { identidade: identidadeFicticia, chave: chaveFicticia(), protocolo })).rejects.toThrow("inválido");
  });
  it("limita número de páginas mesmo para PDF estruturalmente válido", async () => {
    await expect(validarArquivosBrasilNfe({ Base64File: pdfFicticio(101) }, { identidade: identidadeFicticia, chave: chaveFicticia(), protocolo })).rejects.toThrow("inválido");
  });
  it.each([xmlFicticio().replace("<nNF>123</nNF>", "<nNF>999</nNF>"), xmlFicticio().replace("<serie>1</serie>", "<serie>2</serie>")])("rejeita XML com número/série divergente da própria chave", async xml => {
    await expect(validarArquivosBrasilNfe({ Base64Xml: base64(xml) }, { identidade: identidadeFicticia, chave: chaveFicticia(), protocolo })).rejects.toMatchObject({ codigo: "IDENTIDADE_DIVERGENTE" });
  });
  it("exige número/série no XML e aceita zeros à esquerda coerentes", async () => {
    const contexto = { identidade: identidadeFicticia, chave: chaveFicticia(), protocolo };
    await expect(validarArquivosBrasilNfe({ Base64Xml: base64(xmlFicticio().replace("<nNF>123</nNF>", "")) }, contexto)).rejects.toMatchObject({ codigo: "ARQUIVO_INVALIDO" });
    const xml = xmlFicticio().replace("<nNF>123</nNF>", "<nNF>000000123</nNF>").replace("<serie>1</serie>", "<serie>001</serie>");
    expect((await validarArquivosBrasilNfe({ Base64Xml: base64(xml) }, contexto)).xml).toBe(xml);
  });
});
