"use client";
import Link from "next/link";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { completarPeriodo, periodoDoMes, periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tipoLancamentoLabels } from "@/lib/labels";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { calcularPlanilhaFluxoCaixa, calcularResultadoFluxoCaixa, montarArvoreFluxoCaixa, type NoCategoriaFluxo, type LinhaGrupoPlanilha } from "@/lib/financeiro/fluxoCaixa";
import { completarMesesFluxoCaixa, consolidarPlanilhaFluxoCaixaPorMes } from "@/lib/financeiro/fluxoCaixaMensal";
import type { SaldoInicialConta } from "@/lib/financeiro/saldos-iniciais";

import { ExcluirLancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/excluir-lancamento-dialog";
import { estornarBaixaLancamentoAction } from "@/app/(protegido)/financeiro/contas/actions";
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";
import type {
  CategoriaOption,
  ContaBancariaOption,
  FormaPagamentoOption,
  FornecedorOption,
  LancamentoRow,
} from "@/app/(protegido)/financeiro/types";
import type { GrupoDre } from "@/generated/prisma/client";
import { ExportarRelatorioButton } from "../exportar-relatorio-button";
import { montarExportacaoFluxo } from "@/lib/financeiro/exportacao-relatorios";

const STICKY = "sticky left-0 z-10";

function primeiroDiaDoMes(): string {
  return periodoMesAteHoje().de;
}

function hojeIso(): string {
  return periodoMesAteHoje().ate;
}

function celulaClasse(comValor: boolean, temPendente: boolean, tipo: "RECEITA" | "DESPESA") {
  return [
    "text-right tabular-nums",
    comValor && "cursor-pointer underline decoration-dotted underline-offset-2 hover:bg-accent/50",
    comValor && (tipo === "RECEITA" ? "text-success" : "text-destructive"),
    comValor && temPendente && "italic opacity-70",
    !comValor && "text-muted-foreground",
  ]
    .filter(Boolean)
    .join(" ");
}

function CelulaResultado({ receitas, despesas }: { receitas: number; despesas: number }) {
  const resultado = calcularResultadoFluxoCaixa(receitas, despesas);
  const cor = resultado > 0 ? "text-success" : resultado < 0 ? "text-destructive" : "text-muted-foreground";
  return <TableCell className={`py-1.5 text-right text-xs font-normal tabular-nums ${cor}`}>
    {resultado > 0 ? "+" : ""}{formatarMoeda(resultado)}
  </TableCell>;
}

function LinhaCategoria({
  linha,
  dias,
  hoje,
  onAbrirCelula,
  mostrarTotal,
  nivel = 0, chave, expandidas, onAlternar,
}: {
  linha: NoCategoriaFluxo;
  nivel?: number;
  chave: string;
  expandidas: Set<string>;
  onAlternar: (chave: string) => void;
  dias: string[];
  hoje: string;
  onAbrirCelula: (titulo: string, dia: string, ids: string[]) => void;
  mostrarTotal: boolean;
}) {
  const sinal = linha.tipo === "DESPESA" ? -1 : 1;
  const expandida = expandidas.has(chave);
  const nome = linha.categoriaNome.split(" › ").at(-1);
  return (
    <>
    <TableRow>
      <TableCell className={`${STICKY} max-w-72 bg-background font-normal text-muted-foreground`}>
        <div style={{ paddingLeft: `${(nivel + 1) * 16}px` }}>
          {linha.filhos.length ? <button type="button" aria-expanded={expandida}
            aria-label={`${expandida ? "Recolher" : "Expandir"} ${linha.categoriaNome}`}
            onClick={() => onAlternar(chave)} className="flex w-full items-center gap-1.5 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring">
            <ChevronRight className={"size-3.5 shrink-0 transition-transform" + (expandida ? " rotate-90" : "")} />{nome}
          </button> : <span className="pl-5">{nome}</span>}
        </div>
      </TableCell>
      {dias.map((dia) => {
        const celula = linha.porDia[dia];
        const temValor = !!celula && celula.valor > 0;
        return (
          <TableCell
            key={dia}
            className={celulaClasse(temValor, celula?.temPendente ?? false, linha.tipo) + (dia === hoje ? " bg-accent/20" : "")}
            onClick={() => temValor && onAbrirCelula(linha.categoriaNome, dia, celula.lancamentoIds)}
          >
            {temValor ? formatarMoeda(sinal * celula.valor) : "—"}
          </TableCell>
        );
      })}
      {mostrarTotal && <TableCell className="text-right tabular-nums text-muted-foreground">{formatarMoeda(sinal * linha.total)}</TableCell>}
    </TableRow>
    {expandida && linha.filhos.map(filho => <LinhaCategoria key={filho.categoriaId} linha={filho} dias={dias} hoje={hoje}
      nivel={nivel + 1} chave={`${chave}/${filho.categoriaId}`} expandidas={expandidas} onAlternar={onAlternar}
      onAbrirCelula={onAbrirCelula} mostrarTotal={mostrarTotal} />)}
    </>
  );
}

function LinhaGrupo({
  grupoLinha,
  categoriasExpandidas, onAlternarCategoria,
  dias,
  hoje,
  expandido,
  onToggle,
  onAbrirCelula,
  mostrarTotal,
}: {
  grupoLinha: LinhaGrupoPlanilha;
  categoriasExpandidas: Set<string>;
  onAlternarCategoria: (chave: string) => void;
  dias: string[];
  hoje: string;
  expandido: boolean;
  onToggle: () => void;
  onAbrirCelula: (titulo: string, dia: string, ids: string[]) => void;
  mostrarTotal: boolean;
}) {
  const sinal = grupoLinha.tipo === "DESPESA" ? -1 : 1;
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-accent/20" onClick={onToggle}>
        <TableCell className={`${STICKY} max-w-72 bg-background font-medium`}>
          <button type="button" aria-expanded={expandido} aria-label={`${expandido ? "Recolher" : "Expandir"} ${grupoLinha.grupoLabel}`}
            onClick={e => { e.stopPropagation(); onToggle(); }} className="flex w-full items-center gap-1.5 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring">
            <ChevronRight className={"size-3.5 shrink-0 text-muted-foreground transition-transform" + (expandido ? " rotate-90" : "")} />
            {grupoLinha.grupoLabel}
          </button>
        </TableCell>
        {dias.map((dia) => {
          const celula = grupoLinha.porDia[dia];
          const temValor = !!celula && celula.valor > 0;
          return (
            <TableCell
              key={dia}
              className={celulaClasse(temValor, celula?.temPendente ?? false, grupoLinha.tipo) + (dia === hoje ? " bg-accent/20" : "")}
              onClick={(e) => {
                e.stopPropagation();
                if (temValor) onAbrirCelula(grupoLinha.grupoLabel, dia, celula.lancamentoIds);
              }}
            >
              {temValor ? formatarMoeda(sinal * celula.valor) : "—"}
            </TableCell>
          );
        })}
        {mostrarTotal && <TableCell className="text-right font-semibold tabular-nums">{formatarMoeda(sinal * grupoLinha.total)}</TableCell>}
      </TableRow>
      {expandido &&
        montarArvoreFluxoCaixa(grupoLinha.categorias).map((categoria) => (
          <LinhaCategoria
            key={categoria.categoriaId}
            linha={categoria}
            chave={`${grupoLinha.tipo}:${grupoLinha.grupo}/${categoria.categoriaId}`}
            expandidas={categoriasExpandidas} onAlternar={onAlternarCategoria}
            dias={dias}
            hoje={hoje}
            onAbrirCelula={onAbrirCelula}
            mostrarTotal={mostrarTotal}
          />
        ))}
    </>
  );
}

export function FluxoCaixaView({
  saldoInicialTotal,
  saldosIniciais,
  lancamentos,
  categorias,
  planoContas = categorias,
  fornecedores,
  formasPagamento,
  contasBancarias,
}: {
  saldoInicialTotal: number;
  saldosIniciais?: SaldoInicialConta[];
  lancamentos: LancamentoRow[];
  categorias: CategoriaOption[];
  planoContas?: (CategoriaOption & { paiId?: string | null })[];
  fornecedores: FornecedorOption[];
  formasPagamento: FormaPagamentoOption[];
  contasBancarias: ContaBancariaOption[];
}) {
  const [de, setDe] = useState(primeiroDiaDoMes);
  const [ate, setAte] = useState(hojeIso);
  const [agrupamento, setAgrupamento] = useState<"diario" | "mensal">("diario");
  const mensal = agrupamento === "mensal";
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<GrupoDre | "NAO_CLASSIFICADO">>(() => new Set());
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<string>>(() => new Set());
  function alternarCategoria(chave: string) {
    setCategoriasExpandidas(atual => { const proximo = new Set(atual); if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave); return proximo; });
  }
  const [celulaAberta, setCelulaAberta] = useState<{ titulo: string; dia: string; ids: string[] } | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [estornandoId, setEstornandoId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hoje = mensal ? periodoDoMes(hojeIso().slice(0, 7))!.ate : hojeIso();

  const lancamentosPorId = useMemo(() => new Map(lancamentos.map((l) => [l.id, l])), [lancamentos]);

  const periodoConsulta = useMemo(() => {
    const periodo = completarPeriodo({ de, ate }, [...lancamentos.flatMap(l => [l.dataVencimento, l.dataPagamento]), ...(saldosIniciais ?? []).map(s => s.dataSaldoInicial)], hojeIso());
    return mensal ? completarMesesFluxoCaixa(periodo) : periodo;
  }, [de, ate, lancamentos, saldosIniciais, mensal]);
  const planilha = useMemo(() => {
    const diaria = calcularPlanilhaFluxoCaixa(saldoInicialTotal, lancamentos, periodoConsulta, saldosIniciais, planoContas);
    return mensal ? consolidarPlanilhaFluxoCaixaPorMes(diaria) : diaria;
  }, [saldoInicialTotal, lancamentos, periodoConsulta, saldosIniciais, planoContas, mensal]);

  function alterarPeriodo(periodo: { de: string; ate: string }) {
    const limites = mensal ? completarMesesFluxoCaixa(periodo) : periodo;
    setDe(limites.de);
    setAte(limites.ate);
    setCelulaAberta(null);
  }

  function alterarAgrupamento(valor: string | null) {
    if (valor !== "diario" && valor !== "mensal") return;
    setAgrupamento(valor);
    if (valor === "mensal") {
      const limites = completarMesesFluxoCaixa({ de, ate });
      setDe(limites.de);
      setAte(limites.ate);
    }
    setCelulaAberta(null);
  }

  const lancamentosDaCelula = celulaAberta ? celulaAberta.ids.map((id) => lancamentosPorId.get(id)).filter((l): l is LancamentoRow => !!l) : [];

  function toggleGrupo(grupo: GrupoDre | "NAO_CLASSIFICADO") {
    setGruposExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(grupo)) proximo.delete(grupo);
      else proximo.add(grupo);
      return proximo;
    });
  }

  function abrirCelula(titulo: string, dia: string, ids: string[]) {
    setCelulaAberta({ titulo, dia, ids });
  }

  function handleEstornar() {
    if (!estornandoId) return;
    startTransition(async () => {
      const resultado = await estornarBaixaLancamentoAction(estornandoId);
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Baixa cancelada — lançamento voltou a ficar pendente.");
      setEstornandoId(null);
      setCelulaAberta(null);
    });
  }

  return (
    <div className="space-y-4">
      <FiltroPeriodo de={de} ate={ate} aoAlterar={alterarPeriodo}
        acoes={<Select value={agrupamento} onValueChange={alterarAgrupamento}>
          <SelectTrigger aria-label="Visualização do fluxo de caixa" className="h-9!">
            <SelectValue>{() => mensal ? "Mensal" : "Diário"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="diario">Diário</SelectItem>
            <SelectItem value="mensal">Mensal</SelectItem>
          </SelectContent>
        </Select>}
        acoesDireita={<ExportarRelatorioButton obterRelatorio={() => montarExportacaoFluxo(planilha, lancamentos, mensal ? periodoConsulta.de : de, mensal ? periodoConsulta.ate : ate, agrupamento)} />}
      />
      <p className="text-xs text-muted-foreground">
        {mensal ? "Cada coluna consolida um mês completo. O saldo corresponde ao fim do mês. " : "Cada coluna mostra um dia. "}
        Clique em um grupo para abrir suas categorias ou em uma célula para ver os lançamentos {mensal ? "do mês" : "do dia"}.
        Células em <span className="italic opacity-70">itálico</span> incluem valores pendentes (projeção).
      </p>

      <Card className="mx-auto w-fit max-w-full">
        <CardContent className="min-w-0 p-0">
          <Table className="w-auto" aria-label="Fluxo de caixa">
            <TableHeader>
              <TableRow>
                <TableHead className={`${STICKY} max-w-72 bg-background`}>Categoria</TableHead>
                {planilha.dias.map((dia) => (
                  <TableHead key={dia} className={"text-right" + (dia === hoje ? " bg-accent/20 text-foreground" : "")}>
                    {new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", mensal ? { month: "short", year: "numeric" } : { weekday: "short", day: "2-digit", month: "2-digit" })}
                  </TableHead>
                ))}
                {!mensal && <TableHead className="text-right">Total</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={planilha.dias.length + (mensal ? 1 : 2)} className={`${STICKY} bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase`}>
                  Receitas
                </TableCell>
              </TableRow>
              {planilha.receitas.map((grupoLinha) => (
                <LinhaGrupo
                  key={grupoLinha.grupo}
                  grupoLinha={grupoLinha}
                  categoriasExpandidas={categoriasExpandidas} onAlternarCategoria={alternarCategoria}
                  dias={planilha.dias}
                  hoje={hoje}
                  expandido={gruposExpandidos.has(grupoLinha.grupo)}
                  onToggle={() => toggleGrupo(grupoLinha.grupo)}
                  onAbrirCelula={abrirCelula}
                  mostrarTotal={!mensal}
                />
              ))}
              <TableRow className="bg-muted font-semibold hover:bg-muted">
                <TableCell className={`${STICKY} bg-muted`}>Total de Receitas</TableCell>
                {planilha.dias.map((dia) => (
                  <TableCell key={dia} className="text-right tabular-nums">
                    {formatarMoeda(planilha.totalReceitasPorDia[dia])}
                  </TableCell>
                ))}
                {!mensal && <TableCell className="text-right tabular-nums">{formatarMoeda(planilha.totalReceitasGeral)}</TableCell>}
              </TableRow>

              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={planilha.dias.length + (mensal ? 1 : 2)} className={`${STICKY} bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase`}>
                  Despesas
                </TableCell>
              </TableRow>
              {planilha.despesas.map((grupoLinha) => (
                <LinhaGrupo
                  key={grupoLinha.grupo}
                  grupoLinha={grupoLinha}
                  categoriasExpandidas={categoriasExpandidas} onAlternarCategoria={alternarCategoria}
                  dias={planilha.dias}
                  hoje={hoje}
                  expandido={gruposExpandidos.has(grupoLinha.grupo)}
                  onToggle={() => toggleGrupo(grupoLinha.grupo)}
                  onAbrirCelula={abrirCelula}
                  mostrarTotal={!mensal}
                />
              ))}
              <TableRow className="bg-muted font-semibold hover:bg-muted">
                <TableCell className={`${STICKY} bg-muted`}>Total de Despesas</TableCell>
                {planilha.dias.map((dia) => (
                  <TableCell key={dia} className="text-right tabular-nums">
                    {formatarMoeda(-planilha.totalDespesasPorDia[dia])}
                  </TableCell>
                ))}
                {!mensal && <TableCell className="text-right tabular-nums">{formatarMoeda(-planilha.totalDespesasGeral)}</TableCell>}
              </TableRow>

              <TableRow className="bg-foreground text-background hover:bg-foreground">
                <TableCell className={`${STICKY} bg-foreground font-semibold text-background`}>{mensal ? "Saldo do Mês" : "Saldo do Dia"}</TableCell>
                {planilha.dias.map((dia) => (
                  <TableCell key={dia} className="text-right font-semibold tabular-nums text-background">
                    {formatarMoeda(planilha.saldoPorDia[dia])}
                  </TableCell>
                ))}
                {!mensal && <TableCell className="text-right font-semibold tabular-nums text-background">{formatarMoeda(planilha.saldoFinal)}</TableCell>}
              </TableRow>
              <TableRow>
                <TableCell className={`${STICKY} bg-background py-1.5 text-xs font-normal text-muted-foreground`}>{mensal ? "Resultado do Mês" : "Resultado do Dia"}</TableCell>
                {planilha.dias.map(dia => <CelulaResultado key={dia} receitas={planilha.totalReceitasPorDia[dia]} despesas={planilha.totalDespesasPorDia[dia]} />)}
                {!mensal && <CelulaResultado receitas={planilha.totalReceitasGeral} despesas={planilha.totalDespesasGeral} />}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={celulaAberta !== null} onOpenChange={(next) => !next && setCelulaAberta(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="break-words [overflow-wrap:anywhere]">{celulaAberta?.titulo}</DialogTitle>
            <DialogDescription>
              {celulaAberta && new Date(`${celulaAberta.dia}T12:00:00`).toLocaleDateString("pt-BR", mensal ? { month: "long", year: "numeric" } : { weekday: "long", day: "2-digit", month: "long" })}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-1.5 overflow-y-auto overscroll-contain">
            {lancamentosDaCelula.map((l) => (
              <div key={l.id} className="flex min-w-0 flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <Badge className="shrink-0" variant={l.tipo === "RECEITA" ? "success" : "destructive"}>{tipoLancamentoLabels[l.tipo]}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium [overflow-wrap:anywhere]">{l.descricao}</p>
                    <p className="text-xs text-muted-foreground">{l.status === "BAIXADO" ? "Baixado" : "Pendente"}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span className={`whitespace-nowrap font-medium tabular-nums ${l.tipo === "RECEITA" ? "text-success" : "text-destructive"}`}>{formatarMoeda(l.valor)}</span>
                  {l.faturaId && <Link className="text-primary underline" href={`/financeiro/cartoes/faturas/${l.faturaId}`}>Abrir fatura</Link>}
                  {l.pedidoVendaId && <Link className="text-primary underline" href={`/vendas/pedidos/${l.pedidoVendaId}`}>Abrir pedido</Link>}
                  {!l.faturaId && !l.pedidoVendaId && l.status === "PENDENTE" && (
                    <>
                      <LancamentoDialog
                        categorias={categorias}
                        fornecedores={fornecedores}
                        formasPagamento={formasPagamento}
                        contasBancarias={contasBancarias}
                        lancamento={l}
                        trigger={
                          <Button type="button" aria-label="Editar" variant="editar" />
                        }
                      />
                      <Button
                        type="button"
                        variant="excluir"
                        onClick={() => setExcluindoId(l.id)}
                        aria-label="Excluir"
                      />
                    </>
                  )}
                  {!l.faturaId && !l.pedidoVendaId && l.status === "BAIXADO" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setEstornandoId(l.id)}
                      aria-label="Cancelar baixa"
                      title="Cancelar baixa pra poder editar ou excluir"
                    >
                      <Undo2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="shrink-0">
            <DialogClose render={<Button type="button" variant="outline" />}>Fechar</DialogClose>
          </DialogFooter>

          {excluindoId && <ExcluirLancamentoDialog key={excluindoId} lancamentoId={excluindoId} aoFechar={() => setExcluindoId(null)} aoExcluir={() => setCelulaAberta(null)} />}

          <Dialog open={estornandoId !== null} onOpenChange={(next) => !next && setEstornandoId(null)}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Cancelar a baixa deste lançamento?</DialogTitle>
                <DialogDescription>
                  A movimentação bancária gerada por essa baixa é apagada e o lançamento volta a ficar pendente — aí sim dá pra
                  editá-lo ou excluí-lo.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Voltar</DialogClose>
                <Button type="button" disabled={pending} onClick={handleEstornar}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Cancelar baixa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </div>
  );
}
