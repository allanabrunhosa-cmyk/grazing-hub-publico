"use client";

import { Button } from "@/components/ui/button";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { centavos, type ComposicaoCusto, type CustosNotaFiscal, type DetalhamentoTributos, type ModoDescontoNota } from "@/lib/notas-fiscais/custos";
import { CampoMonetario } from "./campo-monetario";

const CAMPOS_ACRESCIDOS: Array<[keyof DetalhamentoTributos, string]> = [
  ["icmsSt", "ICMS-ST"], ["icmsMonofasicoRetido", "ICMS monofásico retido"], ["fcpSt", "FCP-ST"],
  ["impostoImportacao", "Imposto de importação"], ["pisSt", "PIS-ST"], ["cofinsSt", "COFINS-ST"],
  ["ipiDevolvido", "IPI devolvido"],
];
const CAMPOS_INCLUSOS: Array<[keyof DetalhamentoTributos, string]> = [
  ["icmsIncluso", "ICMS"], ["fcpIncluso", "FCP"], ["pisIncluso", "PIS"], ["cofinsIncluso", "COFINS"],
];

function impostosAcrescidos(tributos: DetalhamentoTributos, total: number): [string, number][] {
  const detalhados = CAMPOS_ACRESCIDOS.flatMap(([campo, titulo]) => tributos[campo] ? [[titulo, tributos[campo]] as [string, number]] : []);
  const restante = (centavos(total) - detalhados.reduce((soma, [, valor]) => soma + centavos(valor), 0)) / 100;
  if (restante) detalhados.push(["Outros impostos acrescidos", restante]);
  return detalhados;
}

function impostosInclusos(tributos: DetalhamentoTributos): [string, number][] {
  return CAMPOS_INCLUSOS.flatMap(([campo, titulo]) => tributos[campo] ? [[titulo, tributos[campo]] as [string, number]] : []);
}

export function ResumoCustosNota({ custos, modo, aoMudarModo, bloqueado, descontoDistribuido, erro }: {
  custos: CustosNotaFiscal; modo: ModoDescontoNota; aoMudarModo: (modo: ModoDescontoNota) => void;
  bloqueado: boolean; descontoDistribuido: number; erro: string | null;
}) {
  const valores: [string, number][] = [["Produtos", custos.produtos], ["Frete", custos.frete], ["IPI", custos.ipi]];
  if (custos.seguro) valores.push(["Seguro", custos.seguro]);
  if (custos.outrasDespesas) valores.push(["Outras despesas", custos.outrasDespesas]);
  valores.push(...impostosAcrescidos(custos.tributos, custos.outrosTributos));
  if (custos.abatimentos) valores.push(["Abatimentos", -custos.abatimentos]);
  valores.push(["Desconto", -custos.desconto], ["Total da nota", custos.totalNota]);
  const inclusos = impostosInclusos(custos.tributos);
  const falta = (centavos(custos.desconto) - centavos(descontoDistribuido)) / 100;
  return <section aria-label="Composição do valor da nota" className="space-y-3 rounded-lg border p-3">
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
      {valores.map(([titulo, valor]) => <div key={titulo} className="space-y-0.5">
        <dt className="text-xs text-muted-foreground">{titulo}</dt>
        <dd className={`text-sm tabular-nums ${titulo === "Total da nota" ? "font-semibold" : ""}`}>{formatarMoeda(valor)}</dd>
      </div>)}
    </dl>
    {inclusos.length > 0 && <div className="rounded-md border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
      <p className="font-medium">Impostos já incluídos no valor dos produtos</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {inclusos.map(([titulo, valor]) => <span key={titulo}>{titulo} <strong className="tabular-nums">{formatarMoeda(valor)}</strong></span>)}
      </p>
      <p className="mt-1 text-blue-800 dark:text-blue-300">Informativos: não são somados novamente ao total da nota.</p>
    </div>}
    {custos.desconto > 0 && <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      <span className="text-xs font-medium">Desconto</span>
      <div role="group" aria-label="Distribuição do desconto" className="flex flex-wrap gap-1">
        {([["NOTA", "Conforme a nota"], ["PROPORCIONAL", "Proporcional"], ["PERSONALIZADO", "Personalizado"]] as const).map(([valor, titulo]) =>
          <Button key={valor} type="button" size="sm" className="h-8 px-2 text-xs" variant={modo === valor ? "default" : "outline"}
            aria-pressed={modo === valor} disabled={bloqueado} onClick={() => aoMudarModo(valor)}>{titulo}</Button>)}
      </div>
      {modo === "PERSONALIZADO" && <span className={`text-xs tabular-nums ${falta === 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
        {falta === 0 ? "Desconto distribuído" : `${falta > 0 ? "Falta distribuir" : "Distribuído a mais"}: ${formatarMoeda(Math.abs(falta))}`}
      </span>}
      {modo === "PROPORCIONAL" && <span className="text-xs text-muted-foreground">Pelo valor dos produtos.</span>}
    </div>}
    {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
  </section>;
}

export function ComposicaoCustoItem({ custo, descricao, desconto, aoMudarDesconto, personalizado, bloqueado }: {
  custo: ComposicaoCusto; descricao: string; desconto: string; aoMudarDesconto: (valor: string) => void;
  personalizado: boolean; bloqueado: boolean;
}) {
  const parcelas: [string, number][] = [["Produtos", custo.produtos]];
  if (custo.frete) parcelas.push(["Frete", custo.frete]);
  if (custo.ipi) parcelas.push(["IPI", custo.ipi]);
  if (custo.seguro) parcelas.push(["Seguro", custo.seguro]);
  if (custo.outrasDespesas) parcelas.push(["Outras despesas", custo.outrasDespesas]);
  parcelas.push(...impostosAcrescidos(custo.tributos, custo.outrosTributos));
  if (custo.abatimentos) parcelas.push(["Abatimentos", -custo.abatimentos]);
  if (custo.desconto && !personalizado) parcelas.push(["Desconto", -custo.desconto]);
  const inclusos = impostosInclusos(custo.tributos);
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-muted/40 px-3 py-2" aria-label={`Composição do custo de ${descricao}`}>
    {parcelas.map(([titulo, valor]) => <span key={titulo} className="text-xs text-muted-foreground">{titulo} <span className="tabular-nums text-foreground">{formatarMoeda(valor)}</span></span>)}
    {personalizado && <label className="flex items-center gap-2 text-xs">Desconto
      <CampoMonetario aria-label={`Desconto de ${descricao} em reais`} className="h-8 w-28" value={desconto} onValueChange={aoMudarDesconto} disabled={bloqueado} />
    </label>}
    {inclusos.map(([titulo, valor]) => <span key={`${titulo}-incluso`} className="text-xs text-blue-700 dark:text-blue-300">{titulo} incluído <span className="tabular-nums">{formatarMoeda(valor)}</span></span>)}
    <span className="ml-auto text-xs font-medium tabular-nums">Custo final {formatarMoeda(custo.total)}</span>
  </div>;
}
