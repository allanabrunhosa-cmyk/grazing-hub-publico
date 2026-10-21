import { XMLParser } from "fast-xml-parser";
import type { TipoManifestacao } from "@/generated/prisma/client";
import { assinarElemento } from "@/lib/sefaz/assinatura";
import { chamarNfeRecepcaoEvento } from "@/lib/sefaz/soap";

const TP_AMB_PRODUCAO = "1";
// Eventos de manifestação são sempre recebidos pelo Ambiente Nacional, independente
// da UF do emitente ou do destinatário — por isso cOrgao é fixo em 91 aqui
// (diferente do cUFAutor=35 usado na distribuição, que é a UF de quem consulta).
const C_ORGAO_AMBIENTE_NACIONAL = "91";
const VERSAO_EVENTO = "1.00";

const TP_EVENTO: Record<TipoManifestacao, string> = {
  CONFIRMACAO_DA_OPERACAO: "210200",
  CIENCIA_DA_OPERACAO: "210210",
  DESCONHECIMENTO_DA_OPERACAO: "210220",
  OPERACAO_NAO_REALIZADA: "210240",
};

// Textos fixos exigidos pela SEFAZ — não são livres, precisam bater exatamente com isso.
const DESC_EVENTO: Record<TipoManifestacao, string> = {
  CONFIRMACAO_DA_OPERACAO: "Confirmacao da Operacao",
  CIENCIA_DA_OPERACAO: "Ciencia da Operacao",
  DESCONHECIMENTO_DA_OPERACAO: "Desconhecimento da Operacao",
  OPERACAO_NAO_REALIZADA: "Operacao nao Realizada",
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

export function formatarDataHoraComFuso(data: Date): string {
  // Converter o instante antes de informar -03:00. getHours() depende do servidor:
  // no container UTC, anexar -03:00 ao horário local produzia um evento 3h no futuro (578).
  const horarioBrasilia = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  return `${horarioBrasilia.toISOString().slice(0, 19)}-03:00`;
}

function montarXmlEvento(params: {
  cnpj: string;
  chaveAcesso: string;
  tipo: TipoManifestacao;
  nSeqEvento: number;
  justificativa?: string | null;
}): string {
  const { cnpj, chaveAcesso, tipo, nSeqEvento, justificativa } = params;
  const tpEvento = TP_EVENTO[tipo];
  const nSeqFormatado = String(nSeqEvento).padStart(2, "0");
  const id = `ID${tpEvento}${chaveAcesso}${nSeqFormatado}`;

  const tagJustificativa =
    tipo === "OPERACAO_NAO_REALIZADA" ? `<xJust>${escaparXml(justificativa ?? "")}</xJust>` : "";

  return (
    `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="${VERSAO_EVENTO}">` +
    `<infEvento Id="${id}">` +
    `<cOrgao>${C_ORGAO_AMBIENTE_NACIONAL}</cOrgao>` +
    `<tpAmb>${TP_AMB_PRODUCAO}</tpAmb>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<chNFe>${chaveAcesso}</chNFe>` +
    `<dhEvento>${formatarDataHoraComFuso(new Date())}</dhEvento>` +
    `<tpEvento>${tpEvento}</tpEvento>` +
    `<nSeqEvento>${nSeqEvento}</nSeqEvento>` +
    `<verEvento>${VERSAO_EVENTO}</verEvento>` +
    `<detEvento versao="${VERSAO_EVENTO}">` +
    `<descEvento>${DESC_EVENTO[tipo]}</descEvento>` +
    tagJustificativa +
    `</detEvento>` +
    `</infEvento>` +
    `</evento>`
  );
}

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function montarXmlEnvEvento(eventoAssinado: string, idLote: number): string {
  return (
    `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="${VERSAO_EVENTO}">` +
    `<idLote>${idLote}</idLote>` +
    eventoAssinado +
    `</envEvento>`
  );
}

// O WSDL define nfeRecepcaoEventoNFResult diretamente no Body (document/literal
// bare), sem nfeRecepcaoEventoNFResponse. Também preservamos a leitura do formato
// com wrapper e do conteúdo escapado, usados em respostas simuladas anteriores.
function extrairResultadoDoEnvelopeSoap(envelopeXml: string): unknown {
  const envelope = parser.parse(envelopeXml);
  const corpo = envelope?.Envelope?.Body;
  const resultado =
    corpo?.nfeRecepcaoEventoNFResult ?? corpo?.nfeRecepcaoEventoNFResponse?.nfeRecepcaoEventoNFResult;
  if (resultado == null) {
    throw new Error("Resposta da SEFAZ em formato inesperado (não encontrei nfeRecepcaoEventoNFResult).");
  }
  return resultado;
}

export type ResultadoManifestacao = {
  sucesso: boolean;
  cStat: string;
  xMotivo: string;
  protocolo: string | null;
};

// Lógica pura de interpretação da resposta — separada do envio pra poder ser testada
// com uma resposta simulada.
export function processarRespostaEvento(envelopeResposta: string): ResultadoManifestacao {
  const resultado = extrairResultadoDoEnvelopeSoap(envelopeResposta);
  const parsed = typeof resultado === "string" ? parser.parse(resultado) : resultado;
  const ret = (parsed as Record<string, unknown> | undefined)?.retEnvEvento as Record<string, unknown> | undefined;
  if (!ret) {
    throw new Error("Resposta da SEFAZ não contém retEnvEvento.");
  }

  const retEvento = ret.retEvento as Record<string, unknown> | undefined;
  const infEvento = retEvento?.infEvento as Record<string, unknown> | undefined;
  const cStat = String(infEvento?.cStat ?? ret.cStat ?? "");
  const xMotivo = String(infEvento?.xMotivo ?? ret.xMotivo ?? "");
  const protocolo = infEvento?.nProt ? String(infEvento.nProt) : null;

  // 135 = evento registrado e vinculado à NF-e (sucesso pleno).
  // 136 = evento registrado, mas a NF-e ainda não foi localizada — aceito, mas incompleto.
  const sucesso = cStat === "135" || cStat === "136";

  return { sucesso, cStat, xMotivo, protocolo };
}

// Monta, assina e envia o evento de manifestação pra SEFAZ.
export async function enviarManifestacao(params: {
  cnpj: string;
  chaveAcesso: string;
  tipo: TipoManifestacao;
  justificativa?: string | null;
  nSeqEvento?: number;
}): Promise<ResultadoManifestacao> {
  const nSeqEvento = params.nSeqEvento ?? 1;
  const xmlEvento = montarXmlEvento({ ...params, nSeqEvento });
  const eventoAssinado = await assinarElemento(xmlEvento, "infEvento");
  const xmlEnvEvento = montarXmlEnvEvento(eventoAssinado, 1);

  const envelopeResposta = await chamarNfeRecepcaoEvento(xmlEnvEvento);
  return processarRespostaEvento(envelopeResposta);
}
