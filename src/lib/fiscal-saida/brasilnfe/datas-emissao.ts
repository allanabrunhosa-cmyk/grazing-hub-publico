import type { DocumentoBrasilNfe } from "../brasil-nfe-contrato";
import { hojeFiscal } from "@/lib/tributacao/validacao";

export const JANELA_PREPARACAO_EMISSAO_BRASILNFE_MS = 60_000;
export const MENSAGEM_PREVIA_NFCE_EXPIRADA = "A prévia da NFC-e expirou. Reabra o pedido e tente emitir novamente para recalcular a data de emissão. Nenhum reenvio foi realizado.";

/** Instante fiscal explícito. O calendário do motor e da empresa usa Brasília. */
export function instanteEmissaoBrasilNfe(agora = new Date()): string {
  if (!Number.isFinite(agora.getTime())) throw new Error("Data e hora de emissão inválidas.");
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" }).formatToParts(agora);
  const p = Object.fromEntries(partes.map(v => [v.type, v.value]));
  const fuso = p.timeZoneName.replace("GMT", "") || "+00:00";
  return `${hojeFiscal(agora)}T${p.hour}:${p.minute}:${p.second}${fuso}`;
}

export function dataHoraEmissaoBrasilNfeValida(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  const m = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)([+-])(0\d|1[0-4]):([0-5]\d)$/.exec(valor);
  if (!m || m[6] === "14" && m[7] !== "00") return false;
  const instante = Date.parse(valor);
  const deslocamento = (Number(m[6]) * 60 + Number(m[7])) * (m[5] === "+" ? 1 : -1);
  return Number.isFinite(instante) && new Date(instante + deslocamento * 60_000).toISOString().slice(0, 19) === valor.slice(0, 19);
}

/** Margem local conservadora: a NFC-e exige emissão próxima do envio. */
export function instanteEmissaoRecenteBrasilNfe(instante: unknown, agora = new Date()): boolean {
  if (!dataHoraEmissaoBrasilNfeValida(instante)) return false;
  const idade = Date.parse(instanteEmissaoBrasilNfe(agora)) + agora.getUTCMilliseconds() - Date.parse(instante);
  return idade >= 0 && idade <= JANELA_PREPARACAO_EMISSAO_BRASILNFE_MS;
}

/** Legados sem datas permanecem legados. NFC-e não admite dhSaiEnt. */
export function datasEmissaoBrasilNfeValidas(documento: Pick<DocumentoBrasilNfe, "ModeloDocumento" | "DataEmissao" | "DataEntradaSaida">): boolean {
  if (documento.DataEmissao === undefined) return documento.DataEntradaSaida === undefined;
  return dataHoraEmissaoBrasilNfeValida(documento.DataEmissao) && (documento.ModeloDocumento === 55
    ? documento.DataEntradaSaida === documento.DataEmissao : documento.DataEntradaSaida === undefined);
}

/** Aplica antes do hash. Nunca acrescenta campos ao corpo depois da autorização. */
export function fotografarDatasEmissaoBrasilNfe<T extends { documento: DocumentoBrasilNfe }>(snapshot: T, instante?: string): T {
  if (instante === undefined) return snapshot;
  if (!dataHoraEmissaoBrasilNfeValida(instante)) throw new Error("Data e hora de emissão inválidas. Reprepare a nota.");
  const documento = { ...snapshot.documento, DataEmissao: instante };
  if (documento.ModeloDocumento === 55) documento.DataEntradaSaida = instante;
  else delete documento.DataEntradaSaida;
  return { ...snapshot, documento };
}

type DocumentoAnterior = { status: string; tentativas: number; payload: unknown; referenciaProvedor?: string | null; chaveFiscal?: string | null; protocolo?: string | null; acao?: string | null; leaseToken?: string | null };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function escolherInstantePreparacaoBrasilNfe(anterior: DocumentoAnterior | null, agora = new Date()): string | undefined {
  const atual = instanteEmissaoBrasilNfe(agora);
  const instante = objeto(objeto(objeto(anterior?.payload).tributacao).documento).DataEmissao;
  const preservado = dataHoraEmissaoBrasilNfeValida(instante) ? instante : undefined;
  if (anterior) {
    // Tentativa existente conserva sua fotografia, inclusive a ausência histórica.
    if (anterior.tentativas > 0 || anterior.referenciaProvedor || anterior.chaveFiscal || anterior.protocolo || anterior.acao || anterior.leaseToken || !["SEM_EMISSOR", "PREPARADO"].includes(anterior.status)) return preservado;
    // Reabertura imediata conserva idempotência; rascunho antigo gera nova revisão.
    if (instanteEmissaoRecenteBrasilNfe(preservado, agora)) return preservado;
  }
  return atual;
}
