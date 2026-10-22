import "server-only";
import type { IdentidadeFiscalSaida } from "../contrato";
import { normalizarCnpjBrasilNfe, type ModeloDocumentoBrasilNfe } from "./mapeamento";
import { sanitizarMetadadosErroBrasilNfe, type MetadadosErroBrasilNfe } from "./diagnostico-http";

export type IdentidadeConsultaBrasilNfe = IdentidadeFiscalSaida & { emitenteCnpj: string; modeloDocumento: ModeloDocumentoBrasilNfe };
export type RequisicaoConsultaBrasilNfe = { IdentificadorInterno: string; TipoAmbiente: 1 | 2; ModeloDocumento: ModeloDocumentoBrasilNfe; RetornarArquivos: false };
export const codigoAmbienteBrasilNfe = (ambiente: IdentidadeFiscalSaida["ambiente"]): 1 | 2 => ambiente === "PRODUCAO" ? 1 : 2;
export type EvidenciaNotaBrasilNfe = {
  motivoValidacaoXml?: "DESCRICAO_PRODUTO";
  identificadorInterno: string; modelo: ModeloDocumentoBrasilNfe; ambiente: 1 | 2; situacaoFornecedor: number;
  codigoResposta: number | null; emitida: boolean; emitenteComprovado: boolean;
  chave: string | null; numero: string | null; serie: string | null; protocolo: string | null;
};
export type EvidenciaConsultaBrasilNfe = {
  documentoId: string; encontrada: boolean; notaPrincipal: EvidenciaNotaBrasilNfe | null; historico: EvidenciaNotaBrasilNfe[];
  /** Resultado do processamento da consulta. Não é a situação fiscal de Nota. */
  statusConsulta: 0 | 1; codigoAusencia: "BR0008" | null;
  autorizacoes: EvidenciaNotaBrasilNfe[]; permiteReenvio: false; conferenciaNecessaria: true;
  motivo: "AUSENCIA_SEM_GARANTIA_DE_IDEMPOTENCIA" | "RESULTADO_EXIGE_RECONCILIACAO" | "MULTIPLAS_AUTORIZACOES";
};
export class ErroConsultaBrasilNfe extends Error {
  readonly diagnosticoSeguro: MetadadosErroBrasilNfe | null;
  constructor(public readonly codigo: "CONTEXTO_INVALIDO" | "RESPOSTA_INVALIDA" | "CONSULTA_RECUSADA" | "IDENTIDADE_DIVERGENTE", metadados?: MetadadosErroBrasilNfe) {
    super(codigo === "IDENTIDADE_DIVERGENTE" ? "Documento retornado não corresponde ao emitente, ambiente, modelo ou identidade solicitados." : "Não foi possível comprovar o resultado fiscal da consulta Brasil NFe.");
    this.name = "ErroConsultaBrasilNfe";
    this.diagnosticoSeguro = sanitizarMetadadosErroBrasilNfe(metadados);
    const http = this.diagnosticoSeguro?.httpStatus;
    if (http != null && http !== 200) this.message += http === 403
      ? " HTTP 403: o emissor recusou o acesso. Confira as permissões da integração."
      : ` HTTP ${http}.`;
  }
}
function objeto(v: unknown) {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
  return v as Record<string, unknown>;
}
/** Contrato exclusivo de ConsultarNotaFiscal: 1 processada; 0 mantém o exemplo
 * publicado. BR0008 descreve somente uma consulta sem localização, nunca a
 * inexistência atômica do documento ou uma autorização de reenvio. */
export function conferirEnvelopeConsultaNotaBrasilNfe(resposta: unknown): { status: 0 | 1; codigoAusencia: "BR0008" | null } {
  const r = objeto(resposta);
  if (typeof r.status !== "number" || !Number.isSafeInteger(r.status) || typeof r.Encontrada !== "boolean"
    || !Array.isArray(r.Historico) || r.Historico.length > 1000 || !Array.isArray(r.erros) || r.erros.length > 1000
    || (r.Error != null && (typeof r.Error !== "string" || r.Error.length > 10000))) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
  if ((typeof r.Error === "string" && r.Error.trim()) || ![0, 1].includes(r.status)) throw new ErroConsultaBrasilNfe("CONSULTA_RECUSADA");
  if ((!r.Encontrada && (r.Nota != null || r.Historico.length)) || (r.Encontrada && r.Nota == null)) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
  let codigoAusencia: "BR0008" | null = null;
  if (r.erros.length) {
    for (const item of r.erros) {
      const erro = objeto(item);
      if (typeof erro.codigo !== "string" || erro.codigo.length > 48
        || [erro.descricao, erro.correcao].some(v => v != null && (typeof v !== "string" || v.length > 2000))) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
    }
    if (r.status !== 1 || r.Encontrada || r.erros.length !== 1 || objeto(r.erros[0]).codigo !== "BR0008") throw new ErroConsultaBrasilNfe("CONSULTA_RECUSADA");
    codigoAusencia = "BR0008";
  }
  return { status: r.status as 0 | 1, codigoAusencia };
}

/** Confere cada tentativa sem tomar o status do envelope como autorização. */
export function conferirSituacaoNotaConsultaBrasilNfe(n: { Status: number; Emitida: boolean; CodStatusResposta: number | null; Chave: string | null; Numero: string | null; Serie: string | null; NumeroProtocolo: string | null }): void {
  if (n.Status === 1 && (!n.Emitida || !n.Chave || !n.Numero || !n.Serie || !n.NumeroProtocolo || ![100, 150].includes(n.CodStatusResposta ?? -1))) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
  if (n.Status === 3 && (n.Emitida || !!n.NumeroProtocolo || [100, 150].includes(n.CodStatusResposta ?? -1))) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
}
export function conferirIdentidadeBrasilNfe(i: IdentidadeFiscalSaida): IdentidadeConsultaBrasilNfe {
  try {
    if (!["HOMOLOGACAO", "PRODUCAO"].includes(i.ambiente) || !/^[a-zA-Z0-9_-]{1,100}$/.test(i.documentoId) || i.chaveIdempotencia !== i.documentoId || ![55, 65].includes(i.modeloDocumento!)) throw new Error();
    return { ...i, modeloDocumento: i.modeloDocumento!, emitenteCnpj: normalizarCnpjBrasilNfe(i.emitenteCnpj) };
  } catch { throw new ErroConsultaBrasilNfe("CONTEXTO_INVALIDO"); }
}
export function prepararConsultaBrasilNfe(identidade: IdentidadeFiscalSaida): RequisicaoConsultaBrasilNfe {
  const i = conferirIdentidadeBrasilNfe(identidade);
  return { IdentificadorInterno: i.documentoId, TipoAmbiente: codigoAmbienteBrasilNfe(i.ambiente), ModeloDocumento: i.modeloDocumento, RetornarArquivos: false };
}
function digitos(v: unknown, limite: number): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v) || v < 0) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
    v = String(v);
  }
  if (typeof v !== "string" || !new RegExp(`^[0-9]{1,${limite}}$`).test(v)) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
  return v;
}
export function conferirChaveBrasilNfe(chave: string, identidade: IdentidadeConsultaBrasilNfe) {
  if (!/^\d{44}$/.test(chave)) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
  if (chave.slice(6, 20) !== identidade.emitenteCnpj || chave.slice(20, 22) !== String(identidade.modeloDocumento)) throw new ErroConsultaBrasilNfe("IDENTIDADE_DIVERGENTE");
}
export function conferirNumeroSerieChaveBrasilNfe(chave: string, numero: string | null, serie: string | null) {
  // nNF (9 dígitos) e série (3 dígitos) pertencem à chave. Canonicalização textual
  // aceita zeros à esquerda sem converter identificadores/protocolos em Number.
  const canonico = (v: string) => v.replace(/^0+(?=\d)/, "");
  if ((numero !== null && canonico(numero) !== canonico(chave.slice(25, 34))) || (serie !== null && canonico(serie) !== canonico(chave.slice(22, 25)))) throw new ErroConsultaBrasilNfe("IDENTIDADE_DIVERGENTE");
}
function nota(v: unknown, i: IdentidadeConsultaBrasilNfe): EvidenciaNotaBrasilNfe {
  const n = objeto(v);
  if (n.ModeloDocumento !== i.modeloDocumento || n.CodTipoAmbiente !== codigoAmbienteBrasilNfe(i.ambiente) || n.IdentificadorInterno !== i.documentoId) throw new ErroConsultaBrasilNfe("IDENTIDADE_DIVERGENTE");
  if (!Number.isSafeInteger(n.Status) || Number(n.Status) < 0 || Number(n.Status) > 999 || typeof n.Emitida !== "boolean" || (n.CodStatusResposta != null && (!Number.isSafeInteger(n.CodStatusResposta) || Number(n.CodStatusResposta) < 0 || Number(n.CodStatusResposta) > 9999))) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
  const chave = digitos(n.Chave, 44), numero = digitos(n.Numero, 22), serie = digitos(n.Serie, 3), protocolo = digitos(n.NumeroProtocolo, 30);
  if (chave) { conferirChaveBrasilNfe(chave, i); conferirNumeroSerieChaveBrasilNfe(chave, numero, serie); }
  if (n.CnpjEmissor != null && normalizarCnpjBrasilNfe(n.CnpjEmissor) !== i.emitenteCnpj) throw new ErroConsultaBrasilNfe("IDENTIDADE_DIVERGENTE");
  conferirSituacaoNotaConsultaBrasilNfe({ Status: Number(n.Status), Emitida: n.Emitida, CodStatusResposta: n.CodStatusResposta == null ? null : Number(n.CodStatusResposta), Chave: chave, Numero: numero, Serie: serie, NumeroProtocolo: protocolo });
  return { identificadorInterno: i.documentoId, modelo: i.modeloDocumento, ambiente: codigoAmbienteBrasilNfe(i.ambiente), situacaoFornecedor: Number(n.Status), codigoResposta: n.CodStatusResposta == null ? null : Number(n.CodStatusResposta), emitida: n.Emitida, emitenteComprovado: !!chave || n.CnpjEmissor != null, chave, numero, serie, protocolo,
    ...(n.motivoValidacaoXml === "DESCRICAO_PRODUTO" ? { motivoValidacaoXml: n.motivoValidacaoXml } : {}) };
}
/** Consulta é evidência administrativa, sem evento/sequência inventados. Todos os
 * resultados anteriores são considerados: rejeição mais recente não libera nova
 * emissão quando há autorização no histórico. Ausência não autoriza reenvio. */
export function interpretarConsultaBrasilNfe(resposta: unknown, identidade: IdentidadeFiscalSaida): EvidenciaConsultaBrasilNfe {
  const i = conferirIdentidadeBrasilNfe(identidade), r = objeto(resposta);
  if (typeof r.Encontrada !== "boolean" || !Array.isArray(r.Historico) || r.Historico.length > 100 || !Array.isArray(r.erros) || !Array.isArray(r.avisos) || r.avisos.length > 100 || !r.avisos.every(v => typeof v === "string" && v.length <= 1000) || !Number.isSafeInteger(r.status)) throw new ErroConsultaBrasilNfe("RESPOSTA_INVALIDA");
  const envelope = conferirEnvelopeConsultaNotaBrasilNfe(r);
  const notaPrincipal = r.Encontrada ? nota(r.Nota, i) : null, historico = r.Historico.map(v => nota(v, i));
  const autorizacoes = [...(notaPrincipal ? [notaPrincipal] : []), ...historico].filter(n => n.situacaoFornecedor === 1 && n.emitida && n.chave && n.protocolo);
  const multiplas = new Set(autorizacoes.map(n => n.chave)).size > 1;
  return { documentoId: i.documentoId, encontrada: r.Encontrada, statusConsulta: envelope.status, codigoAusencia: envelope.codigoAusencia, notaPrincipal, historico, autorizacoes, permiteReenvio: false, conferenciaNecessaria: true, motivo: !r.Encontrada ? "AUSENCIA_SEM_GARANTIA_DE_IDEMPOTENCIA" : multiplas ? "MULTIPLAS_AUTORIZACOES" : "RESULTADO_EXIGE_RECONCILIACAO" };
}
