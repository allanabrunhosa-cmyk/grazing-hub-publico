import type { ProdutoEntrada } from "./dominio";

/** Custo da composição fixa por unidade vendida. Escolhas variáveis são calculadas no simulador. */
export function custoComposicaoProduto(produto: Pick<ProdutoEntrada, "componentes">, insumos: { id: string; unidade: string; custo: number | null; ativo: boolean }[]) {
  if (!produto.componentes.length) return null;
  let total = 0;
  for (const componente of produto.componentes) {
    const insumo = insumos.find(i => i.id === componente.insumoId);
    const quantidade = Number(componente.quantidade);
    if (!insumo?.ativo || insumo.unidade !== componente.unidade || insumo.custo == null || !Number.isFinite(quantidade) || quantidade <= 0) return null;
    total += insumo.custo * quantidade;
  }
  return Number.isFinite(total) ? total : null;
}

export function percentualCmv(custo: number | null, preco: string | number) {
  const venda = Number(preco);
  return custo == null || !Number.isFinite(venda) || venda <= 0 ? null : custo / venda * 100;
}
