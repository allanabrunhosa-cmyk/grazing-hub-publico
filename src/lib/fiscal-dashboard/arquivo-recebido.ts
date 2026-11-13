/** Resumos SEFAZ não são o XML completo da nota e não devem ser exportados como tal. */
export function xmlRecebidoCompleto(nota: { tipo: string; xml: string | null }) {
  return nota.tipo === "PROC_NFE" && !!nota.xml?.trim() && !/<!DOCTYPE|<!ENTITY/i.test(nota.xml);
}
