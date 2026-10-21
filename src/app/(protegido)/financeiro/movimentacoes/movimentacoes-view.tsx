"use client";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { dataLancamentoValida, DATA_LANCAMENTO_MIN, DATA_LANCAMENTO_MAX } from "@/lib/financeiro/data-lancamento";
import { useRouter } from "next/navigation";

import { ConciliacaoView } from "./conciliacao-view";
import type { AcessoConciliacao, ExtratoBancarioRow } from "@/lib/financeiro/conciliacao/types";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { LancamentoDialog } from "../lancamentos/lancamento-dialog";
import { baixarLancamentoAction, estornarBaixaLancamentoAction } from "@/app/(protegido)/financeiro/contas/actions";
import { ExcluirLancamentoDialog } from "../lancamentos/excluir-lancamento-dialog";
import { calcularExtrato, dataValida, montarLinhasExtrato, type FiltroMovimentacoes, type LinhaExtrato } from "@/lib/financeiro/extrato";
import { agruparMovimentacoes, type MovimentoAgrupado } from "@/lib/financeiro/agrupar-movimentacoes";
import { baixarNotaFiscalAction } from "./baixar-nota";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { estilosNaturezaFinanceira, naturezaFinanceiraDoValor } from "@/lib/financeiro/natureza-financeira";
import { completarPeriodo, periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { dataParaIso } from "@/lib/financeiro/recorrencia";
import type { SaldoInicialConta } from "@/lib/financeiro/saldos-iniciais";
import type { CategoriaOption, ContaBancariaOption, FormaPagamentoOption, FornecedorOption, LancamentoRow, MovimentacaoBancariaRow } from "../types";

const formatarData = (data: string) => new Date(`${data.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const hojeIso = () => dataParaIso(new Date());

export function MovimentacoesView({ conciliacao, linhas, avulsas, saldoInicial, saldosIniciais, categorias, fornecedores, formasPagamento, contasBancarias, podeCadastrarBeneficiario, entidadeInicialId }: {
  conciliacao?: { acesso: AcessoConciliacao; transacoes: ExtratoBancarioRow[] };
  linhas: LancamentoRow[]; avulsas: MovimentacaoBancariaRow[]; saldoInicial: number;
  saldosIniciais?: SaldoInicialConta[];
  categorias: CategoriaOption[]; fornecedores: FornecedorOption[]; formasPagamento: FormaPagamentoOption[]; contasBancarias: ContaBancariaOption[];
  podeCadastrarBeneficiario?: boolean;
  entidadeInicialId?: string;
}) {
  const router = useRouter();
  const movimentoInicial = linhas.find(l => l.id === entidadeInicialId && l.status !== "CANCELADO" && !l.pedidoQuitadoCredito);
  const [conciliando, setConciliando] = useState(false);
  const [periodoInformado, definirPeriodo] = useState(periodoMesAteHoje);
  const [filtro, definirFiltro] = useState<FiltroMovimentacoes>("TUDO");
  const [selecionadaId, definirSelecionadaId] = useState<string | null>(movimentoInicial?.id ?? null);
  const [leituraInicial, definirLeituraInicial] = useState(Boolean(movimentoInicial));
  const [baixa, definirBaixa] = useState<(LinhaExtrato & { idsAgrupados?: string[] }) | null>(null);
  const [grupoId, definirGrupoId] = useState<string | null>(null);
  const [confirmacao, definirConfirmacao] = useState<{ linha: LinhaExtrato; acao: "ESTORNAR" } | null>(null);
  const [excluindoId, definirExcluindoId] = useState<string | null>(null);
  const [contaId, definirContaId] = useState("");
  const [dataPagamento, definirDataPagamento] = useState(hojeIso);
  const [erro, definirErro] = useState("");
  const [salvando, iniciarTransicao] = useTransition();
  const movimentos = useMemo(() => montarLinhasExtrato(linhas, avulsas), [linhas, avulsas]);
  const periodo = useMemo(() => completarPeriodo(periodoInformado, [...movimentos.map(m => m.data), ...(saldosIniciais ?? []).map(s => s.dataSaldoInicial)], hojeIso()), [periodoInformado, movimentos, saldosIniciais]);
  const extrato = useMemo(() => calcularExtrato(movimentos, saldoInicial, periodo, filtro, saldosIniciais), [movimentos, saldoInicial, periodo, filtro, saldosIniciais]);
  const contagensSituacao = useMemo(() => {
    const completo = filtro === "TUDO" ? extrato : calcularExtrato(movimentos, saldoInicial, periodo, "TUDO", saldosIniciais);
    const grupos = completo.dias.flatMap(dia => agruparMovimentacoes(dia.linhas));
    return { TUDO: grupos.length, BAIXADO: grupos.filter(g => g.status === "BAIXADO").length, PENDENTE: grupos.filter(g => g.status === "PENDENTE").length };
  }, [extrato, filtro, movimentos, saldoInicial, periodo, saldosIniciais]);
  const selecionada = movimentos.find((l) => l.id === selecionadaId);
  const diasAgrupados = useMemo(() => extrato.dias.map((dia) => ({ ...dia, grupos: agruparMovimentacoes(dia.linhas) })), [extrato]);
  const diasComMovimentacao = diasAgrupados.filter((dia) => dia.grupos.length > 0).length;
  const grupoSelecionado = diasAgrupados.flatMap((dia) => dia.grupos).find((grupo) => grupo.id === grupoId);
  const periodoValido = dataValida(periodo.de) && dataValida(periodo.ate) && periodo.de <= periodo.ate;
  const projetado = filtro !== "BAIXADO";
  const diferencaSaldo = (Math.round(extrato.saldoFinal * 100) - Math.round(extrato.saldoAnterior * 100)) / 100;
  const entrada = estilosNaturezaFinanceira.ENTRADA;
  const saida = estilosNaturezaFinanceira.SAIDA;
  const corDiferenca = diferencaSaldo > 0 ? entrada.texto : diferencaSaldo < 0 ? saida.texto : "text-muted-foreground";

  function abrirBaixa(linha: LinhaExtrato & { idsAgrupados?: string[] }) {
    if (linha.lancamento?.pedidoVendaId) { router.push(`/vendas/pedidos/${linha.lancamento.pedidoVendaId}`); return; }
    if (linha.lancamento?.faturaId) { router.push(`/financeiro/cartoes/faturas/${linha.lancamento.faturaId}`); return; }
    definirSelecionadaId(null);
    definirGrupoId(null);
    definirBaixa(linha);
    definirContaId(linha.lancamento?.contaBancariaId ?? (contasBancarias.length === 1 ? contasBancarias[0].id : ""));
    definirDataPagamento(hojeIso());
    definirErro("");
  }

  function abrirGrupo(grupo: MovimentoAgrupado) {
    const fatura = grupo.linhas[0]?.lancamento?.faturaId;
    if (fatura) { router.push(`/financeiro/cartoes/faturas/${fatura}`); return; }
    if (grupo.linhas.length === 1) definirSelecionadaId(grupo.linhas[0].id);
    else definirGrupoId(grupo.id);
  }

  function baixarGrupo(grupo: MovimentoAgrupado) {
    abrirBaixa({ ...grupo.linhas[0], descricao: `${grupo.titulo} · ${grupo.subtitulo}`, valor: grupo.valor,
      idsAgrupados: grupo.linhas.length > 1 ? grupo.linhas.map((linha) => linha.id) : undefined });
  }

  function confirmarBaixa() {
    if (!baixa || !dataLancamentoValida(dataPagamento) || !contaId) return;
    iniciarTransicao(async () => {
      try {
        const resultado = baixa.idsAgrupados
          ? await baixarNotaFiscalAction(baixa.idsAgrupados, contaId, dataPagamento, baixa.valor)
          : await baixarLancamentoAction(baixa.id, contaId, dataPagamento);
        if ("erro" in resultado) { definirErro(resultado.erro); return; }
        toast.success(`Movimentação realizada em ${formatarData(dataPagamento)}.`);
        definirBaixa(null);
      } catch { definirErro("Não foi possível confirmar a baixa. Tente novamente."); }
    });
  }

  function confirmarAlteracao() {
    if (!confirmacao) return;
    iniciarTransicao(async () => {
      try {
        const resultado = await estornarBaixaLancamentoAction(confirmacao.linha.id);
        if ("erro" in resultado) { definirErro(resultado.erro); return; }
        toast.success("Baixa cancelada. Movimentação pendente novamente.");
        definirConfirmacao(null);
      } catch { definirErro("Não foi possível salvar. Tente novamente."); }
    });
  }

  if (conciliando && conciliacao) return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><FiltroPeriodo {...periodoInformado} aoAlterar={definirPeriodo} /><Button type="button" variant="outline" onClick={() => setConciliando(false)}><ArrowLeft className="size-4" />Voltar às movimentações</Button></div>
    <ConciliacaoView linhas={linhas.filter(l => !l.faturaId)} transacoes={conciliacao.transacoes} acesso={conciliacao.acesso} contasBancarias={contasBancarias} categorias={categorias} fornecedores={fornecedores} formasPagamento={formasPagamento} podeCadastrarBeneficiario={podeCadastrarBeneficiario} periodo={periodoInformado} aoAlterarPeriodo={definirPeriodo} />
  </div>;
  return <div className="space-y-4">
    {conciliacao && <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => setConciliando(true)}><ArrowLeftRight className="size-4" />Conciliação bancária</Button></div>}
    <Card className="py-0"><CardContent className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3">
        <div className="min-w-0">
          <FiltroPeriodo {...periodoInformado} aoAlterar={definirPeriodo} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium sm:text-sm">Situação</span>
          <FiltroOpcoesContadas nome="Situação das movimentações" valor={filtro} onValueChange={definirFiltro}
            opcoes={([["TUDO", "Tudo"], ["BAIXADO", "Realizados"], ["PENDENTE", "Pendentes"]] as const).map(([valor, nome]) =>
              ({ valor, nome, quantidade: contagensSituacao[valor] }))} />
        </div>
      </div>
    </CardContent></Card>
    {!periodoValido ? <p role="alert" className="text-sm text-destructive">Informe um período válido, com a data inicial anterior ou igual à final.</p> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { titulo: "Saldo anterior", valor: extrato.saldoAnterior, cor: "", borda: "" },
          { titulo: "Entradas no período", valor: extrato.entradas, cor: entrada.texto, borda: entrada.borda },
          { titulo: "Saídas no período", valor: extrato.saidas, cor: saida.texto, borda: saida.borda },
          { titulo: projetado ? "Saldo final projetado" : "Saldo final realizado", valor: extrato.saldoFinal, cor: "", borda: "", comparar: true },
        ].map(({ titulo, valor, cor, borda, comparar }) =>
          <Card key={titulo} className={borda}><CardContent className="space-y-1 py-4">
            <p className={`text-xs ${cor || "text-muted-foreground"}`}>{titulo}</p>
            <p className={`font-heading text-xl tabular-nums ${cor}`}>{formatarMoeda(valor)}</p>
            {comparar && <p className={`text-xs tabular-nums ${corDiferenca}`}>
              {diferencaSaldo > 0 ? "+" : diferencaSaldo < 0 ? "−" : ""}{formatarMoeda(Math.abs(diferencaSaldo))} em relação ao saldo inicial do período
            </p>}
          </CardContent></Card>)}
      </div>
      <p className="text-xs text-muted-foreground">
        {filtro === "PENDENTE" ? "Projeção apenas das pendências: saldo inicial das contas + pendências anteriores + pendências do período. Realizados não entram neste filtro."
          : filtro === "TUDO" ? "Saldo de todas as contas, incluindo o histórico anterior ao período e as pendências nas datas de vencimento."
          : "Saldo de todas as contas, incluindo o histórico realizado anterior ao período. Pendências não entram no saldo."}
      </p>
      {saldosIniciais?.some((conta) => conta.dataSaldoInicial) && <p className="text-xs text-muted-foreground">O saldo inicial de cada conta passa a valer na data definida. O histórico anterior dessa conta não é somado novamente a partir dela. Pendências sem conta continuam na projeção.</p>}
      <p className="text-xs text-muted-foreground" role="status">{diasComMovimentacao} {diasComMovimentacao === 1 ? "dia com movimentação" : "dias com movimentação"} · {extrato.dias.length - diasComMovimentacao} {extrato.periodoResumido ? "datas exibidas sem movimentação" : "sem movimentação neste filtro"}. {extrato.periodoResumido ? "Intervalos maiores que 366 dias mostram as movimentações, os saldos iniciais e os limites do período. Os totais incluem todo o intervalo." : "Todas as datas do período estão abaixo."}</p>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between gap-2 px-1 text-sm text-muted-foreground"><span>Saldo anterior a {formatarData(periodo.de)}</span><strong className="tabular-nums">{formatarMoeda(extrato.saldoAnterior)}</strong></div>
        {diasAgrupados.map((dia) => <section key={dia.data} className={dia.grupos.length > 0 ? "space-y-3" : "space-y-2 border-b border-dashed border-border/70 pb-4"} aria-label={`Movimentações de ${formatarData(dia.data)}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-1">
              <div className="space-y-1">
                <h2 className={`text-sm first-letter:uppercase ${dia.grupos.length > 0 ? "font-semibold" : "font-medium text-muted-foreground"}`}>{new Date(`${dia.data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</h2>
                {dia.grupos.length > 0 ? <p className="flex items-center gap-1.5 text-xs font-medium text-primary"><span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />{dia.grupos.length} {dia.grupos.length === 1 ? "movimentação" : "movimentações"}</p>
                  : <p className="text-xs text-muted-foreground">Sem movimentação neste filtro</p>}
              </div>
              <p className="text-sm"><span className="text-muted-foreground">{projetado ? "Saldo projetado do dia" : "Saldo do dia"} </span><strong className="tabular-nums">{formatarMoeda(dia.saldo)}</strong></p>
            </div>
            {dia.grupos.length === 0 && dia.temSaldoInicial && <p className="px-1 text-xs text-muted-foreground">Início do controle de saldo de uma ou mais contas. O saldo inicial não é receita nem despesa.</p>}
            {dia.grupos.length > 0 && <Card className="@container gap-0 overflow-hidden py-0"><CardContent className="p-0">
            {dia.temSaldoInicial && <p className="border-b px-4 py-3 text-xs text-muted-foreground">Início do controle de saldo de uma ou mais contas. O saldo inicial não é receita nem despesa.</p>}
            {dia.grupos.length > 0 && <Table className="block @[48rem]:table @[48rem]:table-fixed">
              {/* As mesmas larguras em todos os dias impedem que o conteúdo desloque as colunas. */}
              <colgroup className="hidden @[48rem]:table-column-group"><col className="w-[calc((100%-24rem)*0.6)]" /><col /><col className="w-26" /><col className="w-42" /><col className="w-28" /></colgroup>
              <TableHeader className="sr-only"><TableRow><TableHead>Movimentação</TableHead><TableHead>Categoria / conta</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Valor</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
              <TableBody className="block @[48rem]:table-row-group">{dia.grupos.map((grupo) => <TableRow key={grupo.id} tabIndex={0} aria-label={`Ver detalhes: ${grupo.titulo}`} className="grid grid-cols-[minmax(0,1fr)_9rem] gap-x-3 px-4 py-4 @[48rem]:table-row @[48rem]:p-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-primary" onClick={() => abrirGrupo(grupo)} onKeyDown={(evento) => {
                if (evento.target === evento.currentTarget && (evento.key === "Enter" || evento.key === " ")) { evento.preventDefault(); abrirGrupo(grupo); }
              }}>
                <TableCell className="col-start-1 row-start-1 block min-w-0 whitespace-normal break-words p-0 @[48rem]:table-cell @[48rem]:px-3 @[48rem]:py-5"><p className="font-medium">{grupo.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{grupo.subtitulo}</p></TableCell>
                <TableCell className="col-start-1 row-start-2 block whitespace-normal break-words p-0 pt-3 text-xs @[48rem]:table-cell @[48rem]:px-3 @[48rem]:py-5 @[48rem]:text-sm"><p>{grupo.categoria}</p><p className="mt-1 text-xs text-muted-foreground">{grupo.conta ?? "Conta definida na baixa"}</p></TableCell>
                <TableCell className="col-start-2 row-start-2 block p-0 pt-3 text-right @[48rem]:table-cell @[48rem]:px-3 @[48rem]:py-5 @[48rem]:text-center"><Badge variant={grupo.status === "PENDENTE" ? "warning" : "success"}>{grupo.status === "PENDENTE" ? "Pendente" : "Realizado"}</Badge></TableCell>
                <TableCell className={`col-start-2 row-start-1 block p-0 text-right font-medium tabular-nums @[48rem]:table-cell @[48rem]:px-3 @[48rem]:py-5 ${estilosNaturezaFinanceira[naturezaFinanceiraDoValor(grupo.valor)].texto}`}>{grupo.valor > 0 ? "+ " : ""}{formatarMoeda(grupo.valor)}</TableCell>
                <TableCell className="col-start-2 row-start-3 block p-0 pt-2 text-right @[48rem]:table-cell @[48rem]:px-3 @[48rem]:py-5">{grupo.status === "PENDENTE" ? <Button size="sm" variant={estilosNaturezaFinanceira[naturezaFinanceiraDoValor(grupo.valor)].varianteBotaoContorno} className="w-24" aria-label={`${grupo.linhas[0]?.lancamento?.pedidoVendaId ? "Abrir pedido de" : "Realizar"} ${grupo.titulo}`} onClick={(evento) => { evento.stopPropagation(); baixarGrupo(grupo); }}>{grupo.linhas[0]?.lancamento?.pedidoVendaId ? "Abrir pedido" : <><Check className="size-3.5" />Realizar</>}</Button> : <span className="inline-flex h-8 w-24 items-center justify-center text-xs text-muted-foreground">Ver detalhes</span>}</TableCell>
              </TableRow>)}</TableBody>
            </Table>}
            </CardContent></Card>}
          </section>)}
        <div className="flex justify-between gap-2 border-t px-1 pt-4 text-sm"><strong>{projetado ? "Saldo final projetado" : "Saldo final realizado"}</strong><strong className="tabular-nums">{formatarMoeda(extrato.saldoFinal)}</strong></div>
      </div>
    </>}

    <Dialog open={!!grupoSelecionado} onOpenChange={(aberto) => !aberto && definirGrupoId(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{grupoSelecionado?.titulo}</DialogTitle><DialogDescription>{grupoSelecionado?.subtitulo}</DialogDescription></DialogHeader>
      {grupoSelecionado && <>
        <div className="flex items-center justify-between gap-3"><strong className="text-2xl tabular-nums">{formatarMoeda(grupoSelecionado.valor)}</strong><Badge variant={grupoSelecionado.status === "PENDENTE" ? "warning" : "success"}>{grupoSelecionado.status === "PENDENTE" ? "Pendente" : "Realizado"}</Badge></div>
        <p className="text-sm text-muted-foreground">Composição do valor desta nota em {formatarData(grupoSelecionado.linhas[0].data)}. Selecione um lançamento para consultar ou ajustar seus detalhes.</p>
        <div className="divide-y rounded-xl border">
          {grupoSelecionado.linhas.map((linha) => <button key={linha.id} type="button" className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { definirGrupoId(null); definirSelecionadaId(linha.id); }}>
            <span className="min-w-0"><span className="block break-words font-medium">{linha.lancamento?.notaFiscalItemDescricao ?? linha.descricao}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{linha.categoria} · {linha.conta ?? "Conta definida na baixa"}</span></span><strong className="shrink-0 tabular-nums">{formatarMoeda(linha.valor)}</strong>
          </button>)}
          <div className="flex items-center justify-between gap-4 bg-muted/30 p-4 text-sm font-semibold">
            <span>Valor final da parcela</span><strong className="shrink-0 tabular-nums">{formatarMoeda(Math.abs(grupoSelecionado.valor))}</strong>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => definirGrupoId(null)}>Voltar</Button>{grupoSelecionado.status === "PENDENTE" && <Button onClick={() => baixarGrupo(grupoSelecionado)}><Check className="size-4" />Realizar movimentação</Button>}</DialogFooter>
      </>}
    </DialogContent></Dialog>

    <Dialog open={!!selecionada} onOpenChange={(aberto) => { if (!aberto) { definirSelecionadaId(null); definirLeituraInicial(false); } }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Detalhes da movimentação</DialogTitle><DialogDescription>{selecionada?.descricao}</DialogDescription></DialogHeader>
      {selecionada && <>
        {selecionada.lancamento?.transacaoExtratoId && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Conciliada com o extrato bancário. Ao cancelar a baixa, o vínculo com o extrato também será desfeito e ficará pendente para uma nova conciliação.</p>}
        <div className="flex items-center justify-between"><strong className="text-2xl tabular-nums">{formatarMoeda(selecionada.valor)}</strong><Badge variant={selecionada.status === "PENDENTE" ? "warning" : "success"}>{selecionada.status === "PENDENTE" ? "Pendente" : "Realizado"}</Badge></div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {[["Categoria", selecionada.categoria], ["Conta bancária", selecionada.conta ?? "Definida na baixa"], ["Fornecedor / contraparte", selecionada.contraparte ?? "—"], ["Forma de pagamento", selecionada.lancamento?.formaPagamentoNome ?? "—"],
            ["Competência", selecionada.lancamento ? formatarData(selecionada.lancamento.dataCompetencia) : "—"], ["Vencimento previsto", selecionada.lancamento ? formatarData(selecionada.lancamento.dataVencimento) : "—"], ["Data da transação", selecionada.status === "BAIXADO" ? formatarData(selecionada.data) : "Ainda não realizada"]].map(([titulo, valor]) => <div key={titulo}><dt className="text-muted-foreground">{titulo}</dt><dd className="mt-1 break-words font-medium">{valor}</dd></div>)}
        </dl>
        {selecionada.lancamento?.observacoes && <div className="text-sm"><p className="text-muted-foreground">Observações</p><p className="mt-1 whitespace-pre-wrap break-words">{selecionada.lancamento.observacoes}</p></div>}
        {selecionada.lancamento && !leituraInicial && <DialogFooter className="flex-wrap">
          {selecionada.lancamento.pedidoVendaId ? <Button variant="outline" onClick={() => router.push(`/vendas/pedidos/${selecionada.lancamento!.pedidoVendaId}`)}>Abrir pedido</Button> : selecionada.status === "PENDENTE" ? <>
            <Button variant="ghost" onClick={() => { definirExcluindoId(selecionada.id); definirSelecionadaId(null); }}>Excluir</Button>
            <LancamentoDialog key={selecionada.id} lancamento={selecionada.lancamento} {...{ categorias, fornecedores, formasPagamento, contasBancarias }} aoSalvar={() => definirSelecionadaId(null)} trigger={<Button aria-label="Editar" variant="editar" size="icon-sm" />} />
            <Button variant={estilosNaturezaFinanceira[naturezaFinanceiraDoValor(selecionada.valor)].varianteBotao} onClick={() => abrirBaixa(selecionada)}><Check className="size-4" />Realizar movimentação</Button>
          </> : <Button variant="outline" onClick={() => { definirErro(""); definirConfirmacao({ linha: selecionada, acao: "ESTORNAR" }); definirSelecionadaId(null); }}>Cancelar baixa</Button>}
        </DialogFooter>}
      </>}
    </DialogContent></Dialog>

    <Dialog open={!!baixa} onOpenChange={(aberto) => !aberto && !salvando && definirBaixa(null)}><DialogContent className="sm:max-w-md" showCloseButton={!salvando}>
      <DialogHeader><DialogTitle>Realizar movimentação</DialogTitle><DialogDescription>Confirme a conta e a data em que o dinheiro entrou ou saiu.</DialogDescription></DialogHeader>
      <div className="rounded-md bg-muted p-3 text-sm"><p className="font-medium">{baixa?.descricao}</p><p>{formatarMoeda(baixa?.valor ?? 0)} · Vencimento previsto: {baixa && formatarData(baixa.data)}</p></div>
      {baixa?.idsAgrupados && <p className="text-sm text-muted-foreground">Esta confirmação realiza os {baixa.idsAgrupados.length} lançamentos que compõem o valor exibido desta nota, na mesma conta e data.</p>}
      <div className="space-y-1.5"><Label htmlFor="conta-baixa">Conta bancária</Label><Select value={contaId} onValueChange={(valor) => definirContaId(valor ?? "")} disabled={salvando}><SelectTrigger id="conta-baixa" className="w-full"><SelectValue placeholder="Escolha a conta">{() => contasBancarias.find((c) => c.id === contaId)?.nome ?? "Escolha a conta"}</SelectValue></SelectTrigger><SelectContent>{contasBancarias.map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.nome}</SelectItem>)}</SelectContent></Select></div>
      {contasBancarias.length === 0 && <p className="text-sm text-destructive">Cadastre uma conta ativa em Conta Bancária e Cartões para realizar a movimentação.</p>}
      <div className="space-y-1.5"><Label htmlFor="data-baixa">Data da transação</Label><Input id="data-baixa" type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX} value={dataPagamento} onChange={(evento) => definirDataPagamento(evento.target.value)} disabled={salvando} /><p className="text-xs text-muted-foreground">Pode ser diferente do vencimento. O extrato e o saldo passarão a usar esta data.</p></div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" disabled={salvando} onClick={() => definirBaixa(null)}>Voltar</Button><Button variant={baixa ? estilosNaturezaFinanceira[naturezaFinanceiraDoValor(baixa.valor)].varianteBotao : "default"} disabled={salvando || !contaId || !dataLancamentoValida(dataPagamento)} onClick={confirmarBaixa}>{salvando && <Loader2 className="size-4 animate-spin" />}Confirmar baixa</Button></DialogFooter>
    </DialogContent></Dialog>

    {excluindoId && <ExcluirLancamentoDialog key={excluindoId} lancamentoId={excluindoId} aoFechar={() => definirExcluindoId(null)} />}
    <Dialog open={!!confirmacao} onOpenChange={(aberto) => !aberto && !salvando && definirConfirmacao(null)}><DialogContent showCloseButton={!salvando}>
      <DialogHeader><DialogTitle>Cancelar baixa?</DialogTitle><DialogDescription>{confirmacao?.linha.descricao}. A movimentação bancária será desfeita e o lançamento voltará a ficar pendente no vencimento original.{confirmacao?.linha.lancamento?.transacaoExtratoId && " O vínculo atual com o extrato bancário também será desfeito."}</DialogDescription></DialogHeader>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" disabled={salvando} onClick={() => definirConfirmacao(null)}>Voltar</Button><Button disabled={salvando} onClick={confirmarAlteracao}>{salvando && <Loader2 className="size-4 animate-spin" />}Confirmar cancelamento da baixa</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
