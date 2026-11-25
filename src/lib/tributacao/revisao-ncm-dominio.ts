import type { MateriaisFiscaisFotografados } from "./tipos";

export type DiferencasMateriais = { diverge: boolean; incluidos: string[]; retirados: string[]; preparacoesAlteradas: string[]; assinatura: string };

/** Mesmo critério da resolução do NCM (`materiaisCorrespondem`): marca e identificação de
 * insumo simples não contam; incluir, retirar ou trocar material e alterar a receita de
 * uma preparação contam. A assinatura identifica o estado atual sem depender de marca. */
export function diferencasMateriais(analisados: MateriaisFiscaisFotografados | undefined, atuais: MateriaisFiscaisFotografados | undefined): DiferencasMateriais {
  const a = analisados?.insumos ?? [], b = atuais?.insumos ?? [];
  const incluidos = b.filter(x => !a.some(y => y.insumoId === x.insumoId)).map(x => x.insumoId).sort();
  const retirados = a.filter(x => !b.some(y => y.insumoId === x.insumoId)).map(x => x.insumoId).sort();
  const preparacoesAlteradas = a.filter(x => { const y = b.find(z => z.insumoId === x.insumoId); return !!y && (x.transitiva !== y.transitiva || x.transitiva && x.hash !== y.hash); }).map(x => x.insumoId).sort();
  const assinatura = b.map(x => `${x.insumoId}:${x.transitiva ? x.hash : "simples"}`).sort().join("|");
  return { diverge: incluidos.length + retirados.length + preparacoesAlteradas.length > 0, incluidos, retirados, preparacoesAlteradas, assinatura };
}

export type LimitesEscolha = { minimo: number; maximo: number | null };
/** O cardápio passou a permitir uma contagem de escolhas que a análise não cobre?
 * Compara só os extremos: a equivalência documenta uma faixa única por grupo. */
export function limitesForaDaAnalise(documentado: { quantidadeMinima: string; quantidadeMaxima: string }, cardapio: LimitesEscolha) {
  const min = Number(documentado.quantidadeMinima), max = Number(documentado.quantidadeMaxima);
  return cardapio.minimo < min || cardapio.maximo === null || cardapio.maximo > max;
}
/** Faixa que passa a cobrir a análise anterior e o cardápio atual. Sem máximo no cardápio
 * não há número a registrar: a decisão fica na ficha fiscal. */
export function ampliarLimitesDocumentados(documentado: { quantidadeMinima: string; quantidadeMaxima: string }, cardapio: LimitesEscolha) {
  if (cardapio.maximo === null) return null;
  return { quantidadeMinima: String(Math.min(Number(documentado.quantidadeMinima), cardapio.minimo)), quantidadeMaxima: String(Math.max(Number(documentado.quantidadeMaxima), cardapio.maximo)) };
}
export const descreverLimites = (l: LimitesEscolha) => l.maximo === null ? `a partir de ${l.minimo}, sem máximo` : l.minimo === l.maximo ? `exatamente ${l.minimo}` : `de ${l.minimo} a ${l.maximo}`;
