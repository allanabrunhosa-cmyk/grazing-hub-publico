import { gunzipSync } from "zlib";
import { XMLParser } from "fast-xml-parser";
import { chamarNfeDistribuicaoDFe } from "@/lib/sefaz/soap";

// Código IBGE do estado da empresa que consulta (São Paulo). Não é 91 — esse é
// só um erro comum: 91 identificaria o próprio Ambiente Nacional como autor, o
// que não se aplica a uma empresa comum consultando pelo seu CNPJ.
const CUF_AUTOR = "35";
const TP_AMB_PRODUCAO = "1";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false, // mantém tudo como string — CNPJ/NSU não podem virar número (perderiam zeros à esquerda)
  trimValues: true,
});

export type DocumentoDistribuido = {
  nsu: string;
  schema: string;
  xml: string;
};

export type RespostaDistribuicao = {
  ultNSUPresente?: boolean;
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  documentos: DocumentoDistribuido[];
  envelopeXmlBruto: string;
};

// Erro de parse que carrega o envelope bruto junto — sem isso, uma resposta que não
// bate com o formato esperado (nem que seja um cStat/xMotivo válido) desaparece sem
// deixar rastro assim que o catch de mais alto nível guarda só a mensagem de erro.
export class RespostaSefazInesperada extends Error {
  envelopeXmlBruto: string;
  constructor(message: string, envelopeXmlBruto: string) {
    super(message);
    this.name = "RespostaSefazInesperada";
    this.envelopeXmlBruto = envelopeXmlBruto;
  }
}

function formatarNsu15Digitos(nsu: string): string {
  const digitos = nsu.replace(/\D/g, "");
  if (digitos.length > 15) throw new Error(`NSU inválido (mais de 15 dígitos): ${nsu}`);
  return digitos.padStart(15, "0");
}

function montarXmlDistDFeInt(cnpj: string, ultNSU: string): string {
  const nsuFormatado = formatarNsu15Digitos(ultNSU);
  return (
    `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${TP_AMB_PRODUCAO}</tpAmb>` +
    `<cUFAutor>${CUF_AUTOR}</cUFAutor>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<distNSU><ultNSU>${nsuFormatado}</ultNSU></distNSU>` +
    `</distDFeInt>`
  );
}

// O .asmx da SEFAZ devolve nfeDistDFeInteresseResult como XML aninhado de verdade
// (não como texto escapado) — então o parse já veio pronto num objeto. Ainda assim
// aceitamos string aqui (e reprocessamos) porque não há garantia documentada de que
// isso nunca varie entre ambientes/versões do serviço.
function extrairResultadoDoEnvelopeSoap(envelopeXml: string): unknown {
  const envelope = parser.parse(envelopeXml);
  const resultado =
    envelope?.["soap:Envelope"]?.["soap:Body"]?.["nfeDistDFeInteresseResponse"]?.["nfeDistDFeInteresseResult"] ??
    envelope?.["soap12:Envelope"]?.["soap12:Body"]?.["nfeDistDFeInteresseResponse"]?.["nfeDistDFeInteresseResult"];
  if (resultado == null) {
    throw new Error("Resposta da SEFAZ em formato inesperado (não encontrei nfeDistDFeInteresseResult).");
  }
  return resultado;
}

function descompactarDocZip(base64Gzip: string): string {
  const buffer = Buffer.from(base64Gzip, "base64");
  return gunzipSync(buffer).toString("utf-8");
}

// Lógica pura de interpretação da resposta — separada da chamada de rede pra
// poder ser testada com uma resposta simulada, sem precisar bater na SEFAZ.
export function processarRespostaSoap(envelopeResposta: string, ultNSUConsultado: string): RespostaDistribuicao {
  try {
    const resultado = extrairResultadoDoEnvelopeSoap(envelopeResposta);
    const parsed = typeof resultado === "string" ? parser.parse(resultado) : resultado;
    const ret = (parsed as Record<string, unknown> | undefined)?.retDistDFeInt as Record<string, unknown> | undefined;
    if (!ret) {
      throw new Error("Resposta da SEFAZ não contém retDistDFeInt.");
    }

    const cStat = String(ret.cStat ?? "");
    const xMotivo = String(ret.xMotivo ?? "");
    // ret.ultNSU/ret.maxNSU podem não vir numa rejeição — o fallback aqui é só pra
    // não quebrar o parse, não confundir com uma resposta real da SEFAZ. Quem grava
    // isso no banco (sincronizar.ts) trata como informativo, nunca como novo cursor.
    const ultNSUResposta = String(ret.ultNSU ?? ultNSUConsultado);
    const maxNSU = String(ret.maxNSU ?? ultNSUResposta);

    const loteDistDFeInt = ret.loteDistDFeInt as Record<string, unknown> | undefined;
    const loteBruto = loteDistDFeInt?.docZip;
    const listaDocZip = loteBruto == null ? [] : Array.isArray(loteBruto) ? loteBruto : [loteBruto];

    const documentos: DocumentoDistribuido[] = listaDocZip.map((docZip: Record<string, string>) => ({
      nsu: String(docZip["@_NSU"] ?? ""),
      schema: String(docZip["@_schema"] ?? ""),
      xml: descompactarDocZip(String(docZip["#text"] ?? "")),
    }));

    return { ultNSUPresente: ret.ultNSU != null, cStat, xMotivo, ultNSU: ultNSUResposta, maxNSU, documentos, envelopeXmlBruto: envelopeResposta };
  } catch (erro) {
    throw new RespostaSefazInesperada(
      erro instanceof Error ? erro.message : "Resposta da SEFAZ em formato inesperado.",
      envelopeResposta
    );
  }
}

// Consulta um lote de distribuição a partir do ultNSU informado.
export async function consultarDistribuicao(cnpj: string, ultNSU: string): Promise<RespostaDistribuicao> {
  const xmlRequisicao = montarXmlDistDFeInt(cnpj, ultNSU);
  const envelopeResposta = await chamarNfeDistribuicaoDFe(xmlRequisicao);
  return processarRespostaSoap(envelopeResposta, ultNSU);
}

export async function consultarDocumentoPontual(cnpj: string, tipo: "NSU" | "CHAVE", referencia: string): Promise<RespostaDistribuicao> {
  if (!/^\d{14}$/.test(cnpj) || !(tipo === "NSU" ? /^\d{15}$/ : /^\d{44}$/).test(referencia)) throw new Error("Identificador inválido para consulta pontual.");
  const pedido = tipo === "NSU" ? `<consNSU><NSU>${referencia}</NSU></consNSU>` : `<consChNFe><chNFe>${referencia}</chNFe></consChNFe>`;
  const xml = `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>1</tpAmb><cUFAutor>35</cUFAutor><CNPJ>${cnpj}</CNPJ>${pedido}</distDFeInt>`;
  return processarRespostaSoap(await chamarNfeDistribuicaoDFe(xml), "000000000000000");
}
