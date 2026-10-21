import { XMLParser, XMLValidator } from "fast-xml-parser";
import { extrairDadosDocumento, extrairItensNFe, extrairDuplicatasNFe } from "./parseNFe";

export const TAMANHO_MAXIMO_XML = 800 * 1024;

export function validarXmlImportado(xml: string, chaveEsperada: string | null, cnpj: string) {
  if (!xml.trim() || Buffer.byteLength(xml, "utf8") > TAMANHO_MAXIMO_XML) {
    throw new Error("Selecione um XML de até 800 KB.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new Error("O arquivo não contém um XML válido de NF-e.");
  }
  const documento = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml);
  const nota = documento?.nfeProc?.NFe?.infNFe;
  const protocolo = documento?.nfeProc?.protNFe?.infProt;
  if (!nota || !protocolo || !["100", "150"].includes(String(protocolo.cStat))) {
    throw new Error("Importe o XML completo da NF-e autorizada, com protocolo (nfeProc). Resumo, evento e DANFE não contêm os itens necessários.");
  }
  const chaveAcesso = String(protocolo.chNFe ?? "");
  if (!/^\d{44}$/.test(chaveAcesso) || nota["@_Id"] !== `NFe${chaveAcesso}` || (chaveEsperada !== null && chaveAcesso !== chaveEsperada)) {
    throw new Error("Este XML pertence a outra nota. Confira a chave de acesso.");
  }
  if (nota.dest?.CNPJ !== cnpj) throw new Error("O destinatário deste XML não é o CNPJ configurado no sistema.");
  if (nota.ide?.tpAmb !== "1" || protocolo.tpAmb !== "1" || nota.ide?.mod !== "55") {
    throw new Error("Selecione uma NF-e modelo 55 do ambiente de produção.");
  }
  const dados = extrairDadosDocumento({ xml, schema: "procNFe_v4.00.xsd", nsu: "" });
  const itens = extrairItensNFe(xml);
  extrairDuplicatasNFe(xml);
  if (!dados || !itens.length || !Number.isFinite(dados.valorTotal) || !dados.dataEmissao || Number.isNaN(dados.dataEmissao.getTime())) {
    throw new Error("O XML está incompleto: confira itens, valor total e data de emissão.");
  }
  return dados;
}
