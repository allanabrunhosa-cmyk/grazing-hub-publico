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
