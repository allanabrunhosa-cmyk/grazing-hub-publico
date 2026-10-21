import { ErroFatura } from "./erros";

export type ItemCompensavel = {
  id: string; data: string; valor: number; ignorado: boolean;
  compensadoComId?: string | null; lancamentos: readonly unknown[];
};
// Valores em centavos; o par deve zerar exatamente o mesmo dia.
export function parCompensavel(a: ItemCompensavel, b: ItemCompensavel): boolean {
  return a.id !== b.id && a.data === b.data && /^\d{4}-\d{2}-\d{2}$/.test(a.data)
    && Number.isSafeInteger(a.valor) && Number.isSafeInteger(b.valor)
    && a.valor !== 0 && a.valor + b.valor === 0
    && !a.ignorado && !b.ignorado && !a.compensadoComId && !b.compensadoComId
    && !a.lancamentos.length && !b.lancamentos.length;
}
// Dispensa lançamentos somente quando os dois lados estão íntegros.
export function itensCompensados(itens: readonly ItemCompensavel[]): Set<string> {
  const porId = new Map(itens.map(i => [i.id, i]));
  const ids = new Set<string>();
  for (const item of itens) {
    if (!item.compensadoComId) continue;
    const outro = porId.get(item.compensadoComId);
    if (!outro || outro.compensadoComId !== item.id
      || !parCompensavel({ ...item, compensadoComId: null }, { ...outro, compensadoComId: null })) {
      throw new ErroFatura("Compensação inválida. Confira os dois itens antes de finalizar a fatura.");
    }
    ids.add(item.id);
  }
  return ids;
}
