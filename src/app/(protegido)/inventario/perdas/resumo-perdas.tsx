import { Card, CardContent } from "@/components/ui/card";
import { resumirPerdas, dataDaPerda } from "@/lib/estoque/resumo-perdas";
import type { PerdaRow } from "@/app/(protegido)/inventario/types";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { GraficoMotivosPerdas } from "./grafico-motivos-perdas";

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ResumoPerdas({ linhas, referenciaCores = linhas }: { linhas: PerdaRow[]; referenciaCores?: PerdaRow[] }) {
  const resumo = resumirPerdas(linhas);
  const chavesReferencia = referenciaCores.map(linha => linha.categoriaPerdaId ?? linha.motivo);
  return <section aria-label="Resumo das perdas do período" className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.3fr)]">
    <Card className="min-w-0 py-0!"><CardContent className="space-y-3 p-5">
      <h2 className="text-sm font-medium text-muted-foreground">Valor total de perdas</h2>
      <p className="break-words text-3xl font-semibold tracking-tight text-red-600 dark:text-red-400" data-testid="total-perdas">{moeda(resumo.total)}</p>
      <p className="text-sm">{resumo.registros} {resumo.registros === 1 ? "registro no período" : "registros no período"}</p>
      <p className="text-xs text-muted-foreground">Valor calculado pelo custo médio. Registros excluídos não entram no resumo.</p>
      {resumo.semValor > 0 && <p className="text-xs text-muted-foreground">{resumo.semValor} {resumo.semValor === 1 ? "registro com valor zero" : "registros com valor zero"}.</p>}
    </CardContent></Card>
    <Card className="min-w-0 py-0!"><CardContent className="space-y-3 p-5">
      <h2 className="font-medium">Maiores perdas do período</h2>
      <p className="text-xs text-muted-foreground">Os três maiores registros pelo valor calculado.</p>
      {resumo.maiores.length ? <ol className="space-y-3">{resumo.maiores.map((perda, indice) => <li key={perda.id} className="flex min-w-0 items-start gap-2 text-sm">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{indice + 1}</span>
        <div className="min-w-0 flex-1"><IdentificacaoInsumo nome={perda.insumoNome} especificacao={perda.insumoEspecificacao} nomeClassName="font-medium" /><p className="text-xs text-muted-foreground">{dataDaPerda(perda.data).split("-").reverse().join("/")} · {(perda.valorEstimado / resumo.total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total</p><p className="font-semibold tabular-nums">{moeda(perda.valorEstimado)}</p></div>
      </li>)}</ol> : <p className="py-4 text-sm text-muted-foreground">{resumo.registros ? "Os registros deste período estão com valor zero." : "Nenhuma perda no período selecionado."}</p>}
    </CardContent></Card>
    <Card className="min-w-0 py-0! lg:col-span-2 xl:col-span-1"><CardContent className="space-y-4 p-5">
      <h2 className="font-medium">Principais motivos</h2>
      <p className="text-xs text-muted-foreground">Participação no valor total das perdas.</p>
      <GraficoMotivosPerdas motivos={resumo.motivos} chavesReferencia={chavesReferencia} />
    </CardContent></Card>
  </section>;
}
