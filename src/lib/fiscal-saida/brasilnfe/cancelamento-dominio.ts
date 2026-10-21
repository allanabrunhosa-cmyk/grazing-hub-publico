import { ErroEmissaoPedidoBrasilNfe, type AmbienteEmissaoBrasilNfe } from "./operacional-dominio";

export type ComandoCancelamentoPedidoBrasilNfe = {
  documentoId: string; modelo: 55 | 65; ambiente: AmbienteEmissaoBrasilNfe;
  chaveFiscal: string; protocolo: string; justificativa: string; confirmarCancelamento: true;
};
export function validarComandoCancelamentoPedidoBrasilNfe(v: unknown): ComandoCancelamentoPedidoBrasilNfe {
  const o = v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const campos = ["documentoId", "modelo", "ambiente", "chaveFiscal", "protocolo", "justificativa", "confirmarCancelamento"];
  if (Object.keys(o).length !== campos.length || campos.some(k => !Object.hasOwn(o, k))
    || typeof o.documentoId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(o.documentoId)
    || ![55, 65].includes(o.modelo as number) || !["HOMOLOGACAO", "PRODUCAO"].includes(o.ambiente as string)
    || typeof o.chaveFiscal !== "string" || !/^\d{44}$/.test(o.chaveFiscal)
    || typeof o.protocolo !== "string" || !/^\d{1,30}$/.test(o.protocolo)
    || o.confirmarCancelamento !== true) throw new ErroEmissaoPedidoBrasilNfe("Confirme o cancelamento da nota, modelo, ambiente, chave e protocolo apresentados.");
  if (typeof o.justificativa !== "string" || o.justificativa.trim().length < 15 || o.justificativa.length > 255
    || /[\p{C}<>]/u.test(o.justificativa)) throw new ErroEmissaoPedidoBrasilNfe("Informe uma justificativa de 15 a 255 caracteres, sem códigos ou quebras de linha.");
  return { ...o, justificativa: o.justificativa.trim() } as ComandoCancelamentoPedidoBrasilNfe;
}
