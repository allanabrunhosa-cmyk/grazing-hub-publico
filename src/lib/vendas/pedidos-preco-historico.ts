import type { ItemPedidoEntrada } from "./pedidos-dominio";

export type PrecoItemHistorico = {
  id?: string; produtoId: string | null; quantidade: string | { toString(): string };
  precoOriginal: string | { toString(): string }; precoAplicado: string | { toString(): string };
  acrescimos: string | { toString(): string }; escolhasSnapshot: unknown;
};

/** Uma mudança de origem não é uma nova negociação dos itens já vendidos. */
export function itemComercialPreservado(entrada: ItemPedidoEntrada, anterior?: PrecoItemHistorico): boolean {
  if (!anterior || anterior.produtoId !== entrada.produtoId || Number(entrada.quantidade) !== Number(anterior.quantidade.toString())) return false;
  const escolhas = Array.isArray(anterior.escolhasSnapshot) ? anterior.escolhasSnapshot as { opcaoId: string; quantidade: number }[] : [];
  const esperadas = Object.fromEntries(escolhas.map(e => [e.opcaoId, e.quantidade]));
  const ids = new Set([...Object.keys(entrada.escolhas), ...Object.keys(esperadas)]);
  if ([...ids].some(id => (entrada.escolhas[id] ?? 0) !== (esperadas[id] ?? 0))) return false;
  const manualAnterior = Number(anterior.precoOriginal.toString()) === Number(anterior.precoAplicado.toString()) ? null : anterior.precoAplicado.toString();
  return entrada.precoManual === null ? manualAnterior === null : manualAnterior !== null && Number(entrada.precoManual) === Number(manualAnterior);
}
