export function compararCusto(custoMedio: number, quantidade: number, valorTotal: number) {
  const calculado = Number.isFinite(quantidade) && quantidade > 0 &&
    Number.isFinite(valorTotal) && valorTotal >= 0 ? valorTotal / quantidade : null;
  const precoCompra = calculado != null && Number.isFinite(calculado) ? calculado : null;
  const custoAtual = Number.isFinite(custoMedio) && custoMedio > 0 ? custoMedio : null;
  const percentual = precoCompra != null && custoAtual != null
    ? (precoCompra / custoAtual - 1) * 100 : null;
  return { precoCompra, custoAtual, percentual: percentual != null && Number.isFinite(percentual) ? percentual : null };
}
