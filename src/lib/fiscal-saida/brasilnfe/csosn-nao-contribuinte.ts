/** MOC 7, RV N12a-70. Venda normal NF-e/CRT1: não transformar CSOSN
 * automaticamente. NFC-e e outras operações conservam suas regras próprias. */
export function pendenciaCsosnNaoContribuinte(e: {
  modelo: unknown; crt: unknown; finalidade: unknown; indicadorIe: unknown;
  cfop: unknown; csosn: unknown; indice: number; nome: unknown;
}): string | null {
  if (e.modelo !== 55 || e.crt !== 1 || e.finalidade !== 1 || e.indicadorIe !== 9) return null;
  if (["5915", "5916", "6915", "6916", "5912", "5913"].includes(String(e.cfop))) return null;
  if (["102", "103", "300", "400", "500"].includes(String(e.csosn))) return null;
  const nome = typeof e.nome === "string" && e.nome.trim() ? e.nome.trim() : "Produto";
  return `Item fiscal ${e.indice + 1} — ${nome}: CSOSN ${String(e.csosn)} incompatível com destinatário não contribuinte na NF-e (SEFAZ 600). Corrija o CSOSN na regra de ICMS deste produto e tente novamente.`;
}
