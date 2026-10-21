export type FiltroValidade = "todas" | "vencidas" | "proximas" | "vigentes";
export function filtroValidade(valor: unknown): FiltroValidade {
  return valor === "vencidas" || valor === "proximas" || valor === "vigentes" ? valor : "todas";
}
export function limitesValidade(agora: Date) {
  return { agora, limite: new Date(agora.getTime() + 48 * 60 * 60 * 1000) };
}
export function condicaoValidade(filtro: FiltroValidade, agora: Date) {
  const { limite } = limitesValidade(agora);
  if (filtro === "vencidas") return { lt: agora };
  if (filtro === "proximas") return { gte: agora, lte: limite };
  if (filtro === "vigentes") return { gt: limite };
  return undefined;
}
export function situacaoValidade(validoAte: string, agora: string) {
  const validade = new Date(validoAte).getTime();
  const { limite } = limitesValidade(new Date(agora));
  if (validade < new Date(agora).getTime()) return "Vencida";
  if (validade <= limite.getTime()) return "Vence em até 48h";
  return "Dentro do prazo";
}
