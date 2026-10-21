import { compararCusto } from "@/lib/notas-fiscais/comparar-custo";

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function ComparativoCusto({ custoMedio, quantidade, valorTotal, unidade }: {
  custoMedio: number; quantidade: number; valorTotal: number; unidade: string;
}) {
  const { precoCompra, custoAtual, percentual } = compararCusto(custoMedio, quantidade, valorTotal);
  const arredondado = percentual == null ? null : Math.round(percentual * 100) / 100;
  return <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs" aria-live="polite">
    <p className="text-muted-foreground">Custo médio atual: <strong className="font-medium text-foreground">{custoAtual == null ? "Sem histórico" : `${moeda(custoAtual)} por ${unidade}`}</strong></p>
    <p className="text-muted-foreground">Nova compra: <strong className="font-medium text-foreground">{precoCompra == null ? "Informe quantidade e valor" : `${moeda(precoCompra)} por ${unidade}`}</strong></p>
    {arredondado != null
      ? <p className={arredondado > 0 ? "font-medium text-amber-700 dark:text-amber-400" : arredondado < 0 ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
        {arredondado === 0 ? "Sem variação (0,00%)" : `${arredondado > 0 ? "Subiu +" : "Abaixou −"}${Math.abs(arredondado).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
      </p>
      : custoAtual == null && <p className="text-muted-foreground">Sem custo anterior para comparar.</p>}
  </div>;
}
