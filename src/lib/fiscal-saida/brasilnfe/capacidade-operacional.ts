import "server-only";
import type { AdaptadorFiscalSaida } from "../contrato";
const capacidades = new WeakMap<AdaptadorFiscalSaida, { documentoId: string; ambiente: "HOMOLOGACAO" | "PRODUCAO" }>();
/** Capacidade criada somente após revalidar o registro durável e o documento.
 * Não pode ser reconstruída de DTO, variável de ambiente, callback ou body. */
export function registrarCapacidadeEmissaoManualBrasilNfe(a: AdaptadorFiscalSaida, documentoId: string) {
  if (a.id !== "BRASIL_NFE" || a.bloqueioOperacional || !/^[A-Za-z0-9_-]{1,100}$/.test(documentoId)) throw new Error("Capacidade fiscal inválida.");
  capacidades.set(a, { documentoId, ambiente: a.ambiente }); return a;
}
export function possuiCapacidadeEmissaoManualBrasilNfe(a: AdaptadorFiscalSaida, documentoId?: string) {
  const c = capacidades.get(a);
  return !!c && c.ambiente === a.ambiente && (documentoId === undefined || c.documentoId === documentoId);
}
export function conferirCapacidadeEmissaoManualBrasilNfe(a: AdaptadorFiscalSaida, documentoId: string) {
  if (!possuiCapacidadeEmissaoManualBrasilNfe(a, documentoId)) throw new Error("Ação fiscal sem habilitação manual vinculada ao documento.");
}
