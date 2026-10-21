import type { Prisma } from "@/generated/prisma/client";
export type RespostaFiscalSaida = {
  documentoId: string; eventoId: string;
  status: "NAO_ENCONTRADO" | "PROCESSANDO" | "AUTORIZADO" | "REJEITADO" | "CANCELADO" | "DENEGADO" | "PENDENTE_CONFERENCIA";
  referencia?: string; chave?: string; numero?: string; serie?: string; protocolo?: string;
  /** Protocolo do evento não substitui o protocolo de autorização da nota. */
  protocoloCancelamento?: string;
  /** Alias de leitura dos adaptadores históricos; protocolo separado. */
  protocoloEvento?: string;
  erro?: string;
} & ({ ordenacao?: undefined; sequencia: number } | { ordenacao: "LOCAL_OBSERVACAO"; sequencia?: never });
export type IdentidadeFiscalSaida = {
  documentoId: string; ambiente: "HOMOLOGACAO" | "PRODUCAO"; referencia: string | null; chaveIdempotencia: string;
  /** Contexto explícito do fornecedor; ausente em fotografias comerciais antigas. */
  emitenteCnpj?: string; modeloDocumento?: 55 | 65; ultimaSequencia?: number;
};
/** O adaptador traduz regras do fornecedor, autentica retornos, normaliza ordem e
 * nunca considera HTTP 200 ou referência manual como autorização fiscal. */
export interface AdaptadorFiscalSaida {
  id: string;
  ambiente: "HOMOLOGACAO" | "PRODUCAO";
  /** Adaptador apenas técnico/consulta não pode ser utilizado pela fila operacional. */
  bloqueioOperacional?: string;
  enviar(identidade: IdentidadeFiscalSaida, payload: Prisma.JsonValue): Promise<RespostaFiscalSaida>;
  consultar(identidade: IdentidadeFiscalSaida): Promise<RespostaFiscalSaida>;
  cancelar(identidade: IdentidadeFiscalSaida, motivo: string): Promise<RespostaFiscalSaida>;
  obterDocumentos(identidade: IdentidadeFiscalSaida): Promise<{ xml?: string; pdf?: Uint8Array; html?: string; xmlCancelamento?: string }>;
  /** Prévia sem transmissão e sem autorização fiscal. */
  preVisualizar?(identidade: IdentidadeFiscalSaida, payload: Prisma.JsonValue): Promise<{ xml?: string; pdf?: Uint8Array }>;
  /** Validar assinatura, timestamp/janela antirreplay e identidade do estabelecimento
   * sobre bytes originais. Retornar null para conteúdo não autenticado. */
  autenticarRetorno(corpo: Uint8Array, headers: Headers): Promise<RespostaFiscalSaida | null>;
}
