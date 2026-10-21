"use client";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { dataLancamentoValida, DATA_LANCAMENTO_MIN, DATA_LANCAMENTO_MAX } from "@/lib/financeiro/data-lancamento";
import { SelecaoFormulario } from "@/components/ui/select";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Building2, Check, CheckCheck, FileUp, Landmark, Link2, Loader2, Plus, Undo2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CampoBusca } from "@/components/campo-busca";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoriaFinanceiraCombobox } from "@/components/categoria-financeira-combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aplicarCaixaAltaNoCampo } from "@/lib/caixa-alta";
import type { CategoriaOption, ContaBancariaOption, FormaPagamentoOption, FornecedorOption, LancamentoRow } from "../types";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { estilosNaturezaFinanceira, naturezaFinanceiraDoValor } from "@/lib/financeiro/natureza-financeira";
import { dataValida } from "@/lib/financeiro/extrato";
import { ehSaldoDoDia } from "@/lib/financeiro/conciliacao/arquivo";
import type { AcessoConciliacao, EntradaConciliacao, ExtratoBancarioRow, NovoLancamentoConciliacao } from "@/lib/financeiro/conciliacao/types";
import { conciliarExtratoAction, desfazerConciliacaoAction } from "./conciliacao-actions";
import { ImportarExtratoDialog } from "./importar-extrato-dialog";
import { agruparParaConciliacao, sugerirConciliacoes, TOLERANCIA_VENCIMENTO_CONCILIACAO_DIAS } from "@/lib/financeiro/conciliacao/sugestoes";
import { LancamentoDialog } from "../lancamentos/lancamento-dialog";
import { ExcluirLancamentoDialog } from "../lancamentos/excluir-lancamento-dialog";
import { baixarLancamentoAction, estornarBaixaLancamentoAction } from "@/app/(protegido)/financeiro/contas/actions";
import { baixarNotaFiscalAction } from "./baixar-nota";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";

const dataTexto = (data: string) => data.slice(0, 10).split("-").reverse().join("/");
const hojeIso = () => new Date().toLocaleDateString("en-CA");
const cents = (valor: number) => Math.round(valor * 100);
type FiltroSituacao = "PENDENTES" | "TODAS" | "CONCILIADAS";
type Opcoes = { categorias: CategoriaOption[]; fornecedores: FornecedorOption[]; formasPagamento: FormaPagamentoOption[] };
export function ConciliacaoView({ linhas, transacoes, contasBancarias, acesso, periodo, aoAlterarPeriodo, ...opcoes }: Opcoes & {
  linhas: LancamentoRow[]; transacoes: ExtratoBancarioRow[]; contasBancarias: ContaBancariaOption[]; acesso: AcessoConciliacao;
  periodo: { de: string; ate: string }; aoAlterarPeriodo: (periodo: { de: string; ate: string }) => void;
  podeCadastrarBeneficiario?: boolean;
}) {
  const router = useRouter();
  const [contaId, setContaId] = useState(contasBancarias.length === 1 ? contasBancarias[0].id : "");
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>("PENDENTES");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [grupoDetalheId, setGrupoDetalheId] = useState<string | null>(null);
  const [lancamentoDetalheId, setLancamentoDetalheId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [baixa, setBaixa] = useState<{ lancamentos: LancamentoRow[]; descricao: string; valor: number } | null>(null);
  const [contaBaixaId, setContaBaixaId] = useState("");
  const [dataBaixa, setDataBaixa] = useState(hojeIso);
  const [cancelandoBaixa, setCancelandoBaixa] = useState<LancamentoRow | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const noPeriodo = (data: string) => (!periodo.de || data.slice(0, 10) >= periodo.de) && (!periodo.ate || data.slice(0, 10) <= periodo.ate);
  const bancoPeriodo = transacoes.filter(t => (t.conciliadaEm || !ehSaldoDoDia(t.descricao)) && t.contaBancariaId === contaId && noPeriodo(t.data));
  const banco = bancoPeriodo
    .filter(t => filtroSituacao === "TODAS" || (filtroSituacao === "CONCILIADAS") === !!t.conciliadaEm)
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  const selecionada = banco.find(t => t.id === selecionadaId);
  // Amplia só a busca de candidatas pendentes; o período bancário permanece intacto.
  const grupos = useMemo(() => agruparParaConciliacao(linhas.filter(l => {
    if (l.status === "CANCELADO" || (l.contaBancariaId !== contaId && !(l.status === "PENDENTE" && !l.contaBancariaId))) return false;
    const data = Date.parse((l.status === "BAIXADO" ? l.dataPagamento! : l.dataVencimento).slice(0, 10));
    const margem = l.status === "PENDENTE" ? TOLERANCIA_VENCIMENTO_CONCILIACAO_DIAS * 86_400_000 : 0;
    return (!periodo.de || data >= Date.parse(periodo.de) - margem) && (!periodo.ate || data <= Date.parse(periodo.ate) + margem);
  })), [linhas, contaId, periodo.de, periodo.ate]);
  const { sugestoes, ambiguas } = useMemo(() => sugerirConciliacoes(grupos, transacoes.filter(t => t.contaBancariaId === contaId), acesso.baixar), [grupos, transacoes, contaId, acesso.baixar]);
  const sugestao = selecionada ? sugestoes.get(selecionada.id) : undefined;
  const empresa = grupos.filter(g => noPeriodo(g.linhas[0].data) || g.id === sugestao?.grupoId).filter(g => {
    const conciliado = g.lancamentos.length > 0 && g.lancamentos.every(l => !!l.transacaoExtratoId);
    return filtroSituacao === "TODAS" || (filtroSituacao === "CONCILIADAS") === conciliado;
  }).filter(g => (!selecionada?.conciliadaEm || g.lancamentos.some(l => selecionada.lancamentoIds.includes(l.id))) &&
    (!busca.trim() || `${g.titulo} ${g.subtitulo} ${g.categoria} ${g.lancamentos.map(l => `${l.descricao} ${l.fornecedorNome ?? l.contraparteNome ?? ""}`).join(" ")}`.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR"))))
    .sort((a, b) => a.linhas[0].data.localeCompare(b.linhas[0].data) || a.id.localeCompare(b.id));
  const gruposSelecionados = empresa.filter(g => g.lancamentos.length > 0 && g.lancamentos.every(l => ids.includes(l.id)));
  const selecionados = gruposSelecionados.flatMap(g => g.lancamentos);
  const confirmandoSugestao = !!sugestao && sugestao.ids.length === selecionados.length && sugestao.ids.every(id => ids.includes(id));
  // Em uma NF-e, os itens só discriminam a composição. O pagamento efetivo é sempre
  // o valor final da duplicata, que já contempla frete, descontos e outros custos.
  const valorLiquidoSelecionado = gruposSelecionados.reduce((s, grupo) => s + cents(grupo.valor), 0);
  const diferenca = selecionada ? cents(selecionada.valor) - valorLiquidoSelecionado : 0;
  const contaNome = contasBancarias.find(c => c.id === contaId)?.nome ?? "";
  const grupoDetalhe = grupos.find(g => g.id === grupoDetalheId);
  const lancamentoDetalhe = linhas.find(l => l.id === lancamentoDetalheId);
  function escolher(t: ExtratoBancarioRow) { setSelecionadaId(t.id); setIds(acesso.conciliar ? sugestoes.get(t.id)?.ids ?? [] : []); setBusca(""); setNovo(false); setErro(""); }
  function concluir(input: EntradaConciliacao) { iniciar(async () => { setErro(""); try {
    const resultado = await conciliarExtratoAction(input); if ("erro" in resultado) { setErro(resultado.erro); return; }
    toast.success("Conciliação concluída. Movimentações e relatórios atualizados."); setIds([]); setNovo(false); setSelecionadaId(null); router.refresh();
  } catch { setErro("Não foi possível conciliar. Confira a conexão e tente novamente."); } }); }
  function desfazer() { if (!selecionada) return; iniciar(async () => { setErro(""); try {
    const resultado = await desfazerConciliacaoAction(selecionada.id, motivo); if ("erro" in resultado) { setErro(resultado.erro); return; }
    setDesfazendo(false); setMotivo(""); setSelecionadaId(null); toast.success("Vínculo desfeito. Os lançamentos e as baixas foram preservados."); router.refresh();
  } catch { setErro("Não foi possível desfazer a conciliação."); } }); }
  function impedimento(l: LancamentoRow) {
    if (!selecionada || selecionada.conciliadaEm) return "Escolha uma transação pendente no extrato.";
    if (l.transacaoExtratoId) return "Este lançamento já está conciliado.";
    if (l.status === "PENDENTE" && l.pedidoVendaId) return "Registre o recebimento no pedido antes de conciliar. Abra os detalhes para acessar o pedido.";
    if (l.status === "BAIXADO" && l.contaBancariaId !== selecionada.contaBancariaId) return "Conta da baixa diferente do extrato.";
    if (l.status === "BAIXADO" && l.dataPagamento?.slice(0, 10) !== selecionada.data) return "Data da baixa diferente do extrato.";
    if (l.status === "PENDENTE" && !acesso.baixar) return "Seu acesso não permite realizar a baixa.";
    return "";
  }
  function abrirDetalhes(grupo: (typeof grupos)[number]) {
    if (grupo.lancamentos.length === 1) setLancamentoDetalheId(grupo.lancamentos[0].id);
    else setGrupoDetalheId(grupo.id);
  }
  function abrirBaixa(lancamentosBaixa: LancamentoRow[], descricao: string, valor: number) {
    setGrupoDetalheId(null);
    setLancamentoDetalheId(null);
    setBaixa({ lancamentos: lancamentosBaixa, descricao, valor });
    setContaBaixaId(contaId || (contasBancarias.length === 1 ? contasBancarias[0].id : ""));
    setDataBaixa(selecionada?.data ?? hojeIso());
    setErro("");
  }
  function confirmarBaixa() {
    if (!baixa || !contaBaixaId || !dataLancamentoValida(dataBaixa)) return;
    iniciar(async () => {
      setErro("");
      try {
        const resultado = baixa.lancamentos.length > 1
          ? await baixarNotaFiscalAction(baixa.lancamentos.map(l => l.id), contaBaixaId, dataBaixa, baixa.valor)
          : await baixarLancamentoAction(baixa.lancamentos[0].id, contaBaixaId, dataBaixa);
        if ("erro" in resultado) { setErro(resultado.erro); return; }
        toast.success(`Movimentação realizada em ${dataTexto(dataBaixa)}.`);
        setBaixa(null);
        router.refresh();
      } catch { setErro("Não foi possível realizar a movimentação. Tente novamente."); }
    });
  }
  function cancelarBaixa() {
    if (!cancelandoBaixa) return;
    iniciar(async () => {
      setErro("");
      try {
        const resultado = await estornarBaixaLancamentoAction(cancelandoBaixa.id);
        if ("erro" in resultado) { setErro(resultado.erro); return; }
        toast.success("Baixa cancelada. A movimentação voltou a ficar pendente.");
        setCancelandoBaixa(null);
        router.refresh();
      } catch { setErro("Não foi possível cancelar a baixa. Tente novamente."); }
    });
  }
  if ((periodo.de && !dataValida(periodo.de)) || (periodo.ate && !dataValida(periodo.ate)) || (periodo.de && periodo.ate && periodo.de > periodo.ate)) return <p role="alert" className="text-sm text-destructive">Informe um período válido para as duas listas.</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="grid min-w-56 flex-1 gap-1.5 text-xs font-medium sm:max-w-sm">Conta bancária<SelecaoFormulario aria-label="Conta da conciliação" value={contaId} disabled={pendente} onValueChange={novoValor => { setContaId(novoValor); setSelecionadaId(null); setIds([]); setNovo(false); }}><option value="">Selecione uma conta</option>{contasBancarias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></label>
      {acesso.importar && <Button type="button" variant="outline" disabled={!contaId || pendente} onClick={() => setImportando(true)}><FileUp className="size-4" />Importar OFX / CSV</Button>}
    </div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-muted/30 px-4 py-3 text-xs"><span><strong className="text-primary">1.</strong> Selecione uma transação do banco</span><span><strong className="text-primary">2.</strong> Vincule lançamentos ou crie um novo</span><span><strong className="text-primary">3.</strong> Confira e concilie</span></div>
    {!contaId ? <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground"><Landmark className="mx-auto mb-3 size-8" /><p>Selecione a conta para começar a conciliação.</p></div> : <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[
        ["Transações no período", bancoPeriodo.length], ["Para conciliar", bancoPeriodo.filter(t => !t.conciliadaEm).length], ["Conciliadas", bancoPeriodo.filter(t => t.conciliadaEm).length],
      ].map(([titulo, valor]) => <div key={titulo} className="rounded-xl border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">{titulo}</p><p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <div><p className="text-sm font-medium">Situação da conciliação</p><p className="text-xs text-muted-foreground">Este filtro vale para o extrato bancário e para as movimentações da empresa.</p></div>
        <FiltroOpcoesContadas nome="Situação da conciliação" valor={filtroSituacao} disabled={pendente}
          onValueChange={valor => { setFiltroSituacao(valor); setSelecionadaId(null); setIds([]); setNovo(false); }}
          opcoes={([["PENDENTES", "Pendentes"], ["CONCILIADAS", "Conciliadas"], ["TODAS", "Todas"]] as const).map(([valor, nome]) => ({
            valor, nome, quantidade: bancoPeriodo.filter(t => valor === "TODAS" || (valor === "CONCILIADAS") === !!t.conciliadaEm).length,
          }))} />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section aria-label="Extrato bancário" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between gap-2 border-b bg-primary/5 p-4"><h2 className="flex items-center gap-2 font-semibold"><Landmark className="size-4 text-primary" />Extrato bancário</h2><span className="truncate text-xs text-muted-foreground">{contaNome}</span></div>
          <div className="max-h-[55vh] divide-y overflow-y-auto">{banco.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground"><CheckCheck className="mx-auto mb-3 size-7" /><p>{bancoPeriodo.length ? "Nenhuma transação nesta situação." : "Nenhum extrato neste período. Importe o arquivo do banco ou amplie as datas."}</p></div>}
            {banco.map(t => <button key={t.id} type="button" aria-pressed={selecionadaId === t.id} aria-label={`Conferir ${t.descricao}`} disabled={pendente} onClick={() => escolher(t)} className={`flex w-full items-start gap-3 border-l-[3px] p-4 text-left focus-visible:outline-2 focus-visible:outline-primary ${selecionadaId === t.id ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-muted/30"}`}>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{t.descricao}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{dataTexto(t.data)}<Badge variant={t.conciliadaEm ? "success" : sugestoes.has(t.id) ? "warning" : "muted"}>{t.conciliadaEm ? "Conciliada" : sugestoes.has(t.id) ? "Pré-conciliação" : "A conciliar"}</Badge></span>{ambiguas.has(t.id) && <small className="mt-1 block text-muted-foreground">Mais de uma correspondência possível. Selecione manualmente.</small>}</span><strong className={`shrink-0 text-sm tabular-nums ${t.valor < 0 ? "text-destructive" : "text-emerald-700"}`}>{t.valor > 0 ? "+ " : ""}{formatarMoeda(t.valor)}</strong>
            </button>)}
          </div>
          {selecionada && <div className="space-y-2 border-t bg-muted/20 p-4 text-xs"><p className="break-words"><span className="text-muted-foreground">Arquivo:</span> {selecionada.arquivo}</p>{selecionada.identificador && <p className="break-all"><span className="text-muted-foreground">Identificador:</span> {selecionada.identificador}</p>}
            {selecionada.conciliadaEm && <><p className="font-medium text-emerald-700">Conciliada por {selecionada.conciliadaPorNome} · {dataTexto(selecionada.conciliadaEm)}</p>{acesso.desfazer && <Button type="button" size="sm" variant="outline" onClick={() => { setDesfazendo(true); setErro(""); }}><Undo2 className="size-3.5" />Desfazer conciliação</Button>}</>}
            <details><summary className="cursor-pointer font-medium">Histórico da transação</summary><ol className="mt-2 space-y-2">{selecionada.historico.map((h, i) => <li key={i} className="break-words">{dataTexto(h.data)} · {h.acao === "IMPORTACAO" ? "Importação" : h.acao === "DESCONCILIACAO" ? "Conciliação desfeita" : "Conciliação"} · {h.autor}{h.motivo && <p className="text-muted-foreground">{h.motivo}</p>}</li>)}</ol></details>
          </div>}
        </section>
        <section aria-label="Movimentações da empresa" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/20 p-4"><h2 className="flex items-center gap-2 font-semibold"><Building2 className="size-4 text-primary" />Movimentações da empresa</h2><Badge variant="muted">HUB</Badge></div>
          {novo && selecionada ? <NovoLancamento key={selecionada.id} transacao={selecionada} contaNome={contaNome} opcoes={opcoes} podeCadastrarBeneficiario={opcoes.podeCadastrarBeneficiario} pendente={pendente} erro={erro} aoVoltar={() => setNovo(false)} aoConfirmar={dados => concluir({ transacaoId: selecionada.id, novo: dados })} /> : <>
            <div className="space-y-3 border-b p-4"><CampoBusca aria-label="Buscar movimentação da empresa" placeholder="Descrição, fornecedor ou categoria" value={busca} onChange={(valor) => { setBusca(valor); setIds([]); }} />
              {selecionada ? <p className="text-xs text-muted-foreground">{selecionada.conciliadaEm ? "Os lançamentos vinculados estão identificados abaixo." : `Selecione receitas e despesas para compor o valor líquido de ${formatarMoeda(selecionada.valor)}. Pendências serão realizadas em ${dataTexto(selecionada.data)}; a competência será mantida.`}</p> : <p className="text-xs text-muted-foreground">Selecione uma transação no extrato para escolher os lançamentos correspondentes.</p>}
              {sugestao && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs"><p className="font-semibold text-primary">Pré-conciliação sugerida</p><p className="mt-1">{sugestao.motivo} Confira antes de confirmar. Você pode alterar a seleção.</p></div>}
            </div>
            <div className="relative">
              <div className={`max-h-[55vh] divide-y overflow-y-auto ${selecionada && !selecionada.conciliadaEm ? "pb-40 sm:pb-28" : ""}`}>
                {empresa.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação da empresa nesta situação e período.</p>}
                {empresa.map(g => {
                  const bloqueio = g.lancamentos.map(impedimento).find(Boolean);
                  const marcados = g.lancamentos.every(l => ids.includes(l.id));
                  const conciliados = g.lancamentos.filter(l => l.transacaoExtratoId).length;
                  return <div key={g.id} className={marcados ? "bg-primary/5" : "hover:bg-muted/20"}>
                    <div className="flex items-start gap-3 p-4">
                      <input type="checkbox" aria-label={`Selecionar ${g.titulo}${g.lancamentos[0].notaFiscal ? ` · ${g.subtitulo}` : ""}`} className="mt-1 size-4 shrink-0 accent-blue-600" disabled={pendente || !acesso.conciliar || !!bloqueio} checked={marcados} onChange={e => setIds(e.target.checked ? [...new Set([...ids, ...g.lancamentos.map(l => l.id)])] : ids.filter(id => !g.lancamentos.some(l => l.id === id)))} />
                      <button type="button" aria-label={`Ver detalhes de ${g.titulo}`} className="-m-2 flex min-w-0 flex-1 items-start gap-3 rounded-lg p-2 text-left focus-visible:outline-2 focus-visible:outline-primary" onClick={() => abrirDetalhes(g)}>
                        <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{g.titulo}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{g.subtitulo} · {g.categoria}</span><span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{dataTexto(g.linhas[0].data)}<Badge variant={conciliados === g.lancamentos.length ? "success" : conciliados || g.status === "PENDENTE" ? "warning" : "muted"}>{conciliados === g.lancamentos.length ? "Conciliado" : conciliados ? "Parcialmente conciliado" : g.status === "PENDENTE" ? "Pendente" : "Realizado"}</Badge>{sugestao?.grupoId === g.id && <span className="font-medium text-primary">Correspondência sugerida</span>}</span>{bloqueio && selecionada && !selecionada.conciliadaEm && <small className="mt-1 block text-muted-foreground">{bloqueio}</small>}<small className="mt-2 block font-medium text-primary">Ver detalhes</small></span>
                        <strong className={`shrink-0 text-sm tabular-nums ${g.valor < 0 ? "text-destructive" : "text-emerald-700"}`}>{g.valor > 0 ? "+ " : ""}{formatarMoeda(g.valor)}</strong>
                      </button>
                    </div>
                    {g.lancamentos.length > 1 && <details className="px-4 pb-3 pl-11 text-xs text-muted-foreground"><summary className="cursor-pointer">Ver composição da nota ({g.lancamentos.length} itens)</summary><ul className="mt-2 space-y-2">{g.lancamentos.map(l => <li key={l.id} className="flex justify-between gap-3"><span className="min-w-0 break-words">{l.notaFiscalItemDescricao ?? l.descricao}</span><span className="shrink-0 tabular-nums">{formatarMoeda(l.valor)}</span></li>)}<li className="flex justify-between gap-3 border-t pt-2 font-semibold text-foreground"><span>Valor final da parcela</span><span className="shrink-0 tabular-nums">{formatarMoeda(Math.abs(g.valor))}</span></li></ul></details>}
                  </div>;
                })}
              </div>
              {selecionada && !selecionada.conciliadaEm && <div aria-label="Ações da conciliação" className="fixed inset-x-4 bottom-4 z-40 space-y-3 rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:right-6 sm:w-[min(36rem,calc(100vw-3rem))]"><div aria-live="polite" className="flex flex-wrap justify-between gap-2 text-sm"><span>Líquido selecionado <strong>{formatarMoeda(valorLiquidoSelecionado / 100)}</strong></span><span className={diferenca === 0 ? "font-medium text-emerald-700" : "text-muted-foreground"}>Diferença: {formatarMoeda(diferenca / 100)}</span></div><div className="flex flex-wrap gap-2">
                <Button type="button" className="min-w-48 flex-1" disabled={pendente || !acesso.conciliar || !selecionados.length || diferenca !== 0 || selecionados.some(l => !!impedimento(l))} onClick={() => concluir({ transacaoId: selecionada.id, lancamentos: selecionados.map(l => ({ id: l.id, versao: l.versao ?? "" })) })}>{pendente ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}{confirmandoSugestao ? "Confirmar pré-conciliação" : "Conciliar selecionados"}</Button>
                {acesso.criar && <Button type="button" variant={estilosNaturezaFinanceira[naturezaFinanceiraDoValor(selecionada.valor)].varianteBotaoContorno} disabled={pendente} onClick={() => { setNovo(true); setIds([]); setErro(""); }}><Plus className="size-4" />Criar {selecionada.valor < 0 ? "despesa" : "receita"}</Button>}
              </div>{diferenca !== 0 && selecionados.length > 0 && <p className="text-xs text-muted-foreground">O total deve coincidir com o extrato. Nenhuma diferença será ajustada automaticamente.</p>}</div>}
            </div>
          </>}
        </section>

      </div>
      <p className="text-xs text-muted-foreground">As duas listas usam o mesmo período. Pendências usam vencimento; realizados e extrato usam a data da transação. Transferências entre contas não devem ser classificadas como receita ou despesa.</p>
    </>}
    {erro && !desfazendo && !novo && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
    {importando && <ImportarExtratoDialog contaId={contaId} contaNome={contaNome} aoFechar={() => setImportando(false)} aoImportar={periodo => { aoAlterarPeriodo(periodo); setFiltroSituacao("PENDENTES"); setSelecionadaId(null); router.refresh(); }} />}
    <Dialog open={!!grupoDetalhe} onOpenChange={aberto => !aberto && setGrupoDetalheId(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{grupoDetalhe?.titulo}</DialogTitle><DialogDescription>{grupoDetalhe?.subtitulo}</DialogDescription></DialogHeader>
      {grupoDetalhe && <>
        <div className="flex items-center justify-between gap-3"><strong className="text-2xl tabular-nums">{formatarMoeda(grupoDetalhe.valor)}</strong><Badge variant={grupoDetalhe.status === "PENDENTE" ? "warning" : "success"}>{grupoDetalhe.status === "PENDENTE" ? "Pendente" : "Realizado"}</Badge></div>
        <p className="text-sm text-muted-foreground">Composição do valor desta nota em {dataTexto(grupoDetalhe.linhas[0].data)}. Selecione um lançamento para consultar ou ajustar seus detalhes.</p>
        <div className="divide-y rounded-xl border">
          {grupoDetalhe.lancamentos.map(l => <button key={l.id} type="button" className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setGrupoDetalheId(null); setLancamentoDetalheId(l.id); }}>
            <span className="min-w-0"><span className="block break-words font-medium">{l.notaFiscalItemDescricao ?? l.descricao}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{l.categoriaNome} · {l.contaBancariaNome ?? "Conta definida na baixa"}</span></span><strong className="shrink-0 tabular-nums">{formatarMoeda(l.valor)}</strong>
          </button>)}
          <div className="flex items-center justify-between gap-4 bg-muted/30 p-4 text-sm font-semibold"><span>Valor final da parcela</span><strong className="shrink-0 tabular-nums">{formatarMoeda(Math.abs(grupoDetalhe.valor))}</strong></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setGrupoDetalheId(null)}>Voltar</Button>{grupoDetalhe.status === "PENDENTE" && acesso.baixar && <Button onClick={() => abrirBaixa(grupoDetalhe.lancamentos, `${grupoDetalhe.titulo} · ${grupoDetalhe.subtitulo}`, grupoDetalhe.valor)}><Check className="size-4" />Realizar movimentação</Button>}</DialogFooter>
      </>}
    </DialogContent></Dialog>

    <Dialog open={!!lancamentoDetalhe} onOpenChange={aberto => !aberto && setLancamentoDetalheId(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Detalhes da movimentação</DialogTitle><DialogDescription>{lancamentoDetalhe?.descricao}</DialogDescription></DialogHeader>
      {lancamentoDetalhe && <>
        {lancamentoDetalhe.transacaoExtratoId && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Conciliada com o extrato bancário. Desfaça o vínculo na conciliação antes de cancelar a baixa.</p>}
        <div className="flex items-center justify-between gap-3"><strong className="text-2xl tabular-nums">{lancamentoDetalhe.tipo === "DESPESA" ? "− " : "+ "}{formatarMoeda(lancamentoDetalhe.valor)}</strong><Badge variant={lancamentoDetalhe.status === "PENDENTE" ? "warning" : "success"}>{lancamentoDetalhe.status === "PENDENTE" ? "Pendente" : "Realizado"}</Badge></div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Categoria", lancamentoDetalhe.categoriaNome],
            ["Conta bancária", lancamentoDetalhe.contaBancariaNome ?? "Definida na baixa"],
            ["Fornecedor / contraparte", lancamentoDetalhe.fornecedorNome ?? lancamentoDetalhe.contraparteNome ?? "—"],
            ["Forma de pagamento", lancamentoDetalhe.formaPagamentoNome ?? "—"],
            ["Competência", dataTexto(lancamentoDetalhe.dataCompetencia)],
            ["Vencimento previsto", dataTexto(lancamentoDetalhe.dataVencimento)],
            ["Data da transação", lancamentoDetalhe.status === "BAIXADO" && lancamentoDetalhe.dataPagamento ? dataTexto(lancamentoDetalhe.dataPagamento) : "Ainda não realizada"],
          ].map(([titulo, valor]) => <div key={titulo}><dt className="text-muted-foreground">{titulo}</dt><dd className="mt-1 break-words font-medium">{valor}</dd></div>)}
        </dl>
        {lancamentoDetalhe.observacoes && <div className="text-sm"><p className="text-muted-foreground">Observações</p><p className="mt-1 whitespace-pre-wrap break-words">{lancamentoDetalhe.observacoes}</p></div>}
        <DialogFooter className="flex-wrap">
          {lancamentoDetalhe.pedidoVendaId ? <Button variant="outline" onClick={() => router.push(`/vendas/pedidos/${lancamentoDetalhe.pedidoVendaId}`)}>Abrir pedido</Button> : lancamentoDetalhe.status === "PENDENTE" ? <>
            {acesso.excluirMovimentacao && <Button variant="ghost" onClick={() => { setExcluindoId(lancamentoDetalhe.id); setLancamentoDetalheId(null); }}>Excluir</Button>}
            {acesso.editarMovimentacao && <LancamentoDialog key={lancamentoDetalhe.id} lancamento={lancamentoDetalhe} categorias={opcoes.categorias} fornecedores={opcoes.fornecedores} formasPagamento={opcoes.formasPagamento} contasBancarias={contasBancarias} trigger={<Button aria-label="Editar" variant="editar" size="icon-sm" />} />}
            {acesso.baixar && <Button onClick={() => abrirBaixa([lancamentoDetalhe], lancamentoDetalhe.descricao, lancamentoDetalhe.tipo === "DESPESA" ? -lancamentoDetalhe.valor : lancamentoDetalhe.valor)}><Check className="size-4" />Realizar movimentação</Button>}
          </> : acesso.baixar && !lancamentoDetalhe.transacaoExtratoId ? <Button variant="outline" onClick={() => { setCancelandoBaixa(lancamentoDetalhe); setLancamentoDetalheId(null); setErro(""); }}>Cancelar baixa</Button> : null}
        </DialogFooter>
      </>}
    </DialogContent></Dialog>

    <Dialog open={!!baixa} onOpenChange={aberto => !aberto && !pendente && setBaixa(null)}><DialogContent className="sm:max-w-md" showCloseButton={!pendente}>
      <DialogHeader><DialogTitle>Realizar movimentação</DialogTitle><DialogDescription>Confirme a conta e a data em que o dinheiro entrou ou saiu.</DialogDescription></DialogHeader>
      <div className="rounded-xl bg-muted p-3 text-sm"><p className="font-medium">{baixa?.descricao}</p><p>{formatarMoeda(baixa?.valor ?? 0)}</p></div>
      {baixa && baixa.lancamentos.length > 1 && <p className="text-sm text-muted-foreground">Esta confirmação realiza os {baixa.lancamentos.length} lançamentos que compõem o valor final desta nota.</p>}
      <label className="grid gap-1.5 text-xs font-medium">Conta bancária<SelecaoFormulario aria-label="Conta bancária da baixa" value={contaBaixaId} disabled={pendente} onValueChange={novoValor => setContaBaixaId(novoValor)}><option value="">Escolha a conta</option>{contasBancarias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></label>
      <div className="space-y-1.5"><Label htmlFor="data-baixa-conciliacao">Data da transação</Label><Input id="data-baixa-conciliacao" type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX} value={dataBaixa} disabled={pendente} onChange={e => setDataBaixa(e.target.value)} /><p className="text-xs text-muted-foreground">Ao conferir uma transação do banco, esta data já vem preenchida para facilitar a conciliação.</p></div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" disabled={pendente} onClick={() => setBaixa(null)}>Voltar</Button><Button disabled={pendente || !contaBaixaId || !dataLancamentoValida(dataBaixa)} onClick={confirmarBaixa}>{pendente && <Loader2 className="size-4 animate-spin" />}Confirmar baixa</Button></DialogFooter>
    </DialogContent></Dialog>

    {excluindoId && <ExcluirLancamentoDialog key={excluindoId} lancamentoId={excluindoId} aoFechar={() => setExcluindoId(null)} aoExcluir={() => router.refresh()} />}
    <Dialog open={!!cancelandoBaixa} onOpenChange={aberto => !aberto && !pendente && setCancelandoBaixa(null)}><DialogContent showCloseButton={!pendente}>
      <DialogHeader><DialogTitle>Cancelar baixa?</DialogTitle><DialogDescription>{cancelandoBaixa?.descricao}. A movimentação voltará a ficar pendente no vencimento original.</DialogDescription></DialogHeader>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" disabled={pendente} onClick={() => setCancelandoBaixa(null)}>Voltar</Button><Button disabled={pendente} onClick={cancelarBaixa}>{pendente && <Loader2 className="size-4 animate-spin" />}Confirmar cancelamento da baixa</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={desfazendo} onOpenChange={aberto => { if (!pendente) setDesfazendo(aberto); }}><DialogContent showCloseButton={!pendente}><DialogHeader><DialogTitle>Desfazer conciliação?</DialogTitle><DialogDescription>Remove apenas o vínculo com o extrato. Os lançamentos e pagamentos permanecem realizados, sem mudar caixa ou DRE. A alteração ficará no histórico.</DialogDescription></DialogHeader><Label htmlFor="motivo-desconciliacao">Motivo</Label><Textarea id="motivo-desconciliacao" value={motivo} disabled={pendente} maxLength={1000} onChange={e => setMotivo(e.target.value)} />{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<DialogFooter><Button type="button" variant="outline" disabled={pendente} onClick={() => setDesfazendo(false)}>Voltar</Button><Button type="button" variant="destructive" disabled={pendente || motivo.trim().length < 3} onClick={desfazer}>Desfazer vínculo</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function NovoLancamento({ transacao, contaNome, opcoes, podeCadastrarBeneficiario, pendente, erro, aoVoltar, aoConfirmar }: { transacao: ExtratoBancarioRow; contaNome: string; opcoes: Opcoes; podeCadastrarBeneficiario?: boolean; pendente: boolean; erro: string; aoVoltar: () => void; aoConfirmar: (dados: NovoLancamentoConciliacao) => void }) {
  const [categoriaId, setCategoriaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [beneficiariosCriados, setBeneficiariosCriados] = useState<FornecedorOption[]>([]);
  const [erroFormulario, setErroFormulario] = useState("");
  const categorias = opcoes.categorias.filter(c => GRUPOS_RECEITA.includes(c.grupo) === (transacao.valor > 0));
  const fornecedores = [...opcoes.fornecedores, ...beneficiariosCriados.filter((criado) => !opcoes.fornecedores.some((fornecedor) => fornecedor.id === criado.id))];
  const natureza = naturezaFinanceiraDoValor(transacao.valor);
  const estilo = estilosNaturezaFinanceira[natureza];
  return <form className="space-y-4 p-4" noValidate onSubmit={e => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const descricao = String(dados.get("descricao") ?? "").trim();
    const dataCompetencia = String(dados.get("competencia") ?? "");
    const dataVencimento = String(dados.get("vencimento") ?? "");
    if (!descricao || !categoriaId || !dataLancamentoValida(dataCompetencia) || !dataLancamentoValida(dataVencimento)) {
      setErroFormulario("Preencha a descrição, a categoria, a competência e o vencimento com valores válidos.");
      return;
    }
    setErroFormulario("");
    aoConfirmar({ descricao, categoriaId, dataCompetencia, dataVencimento, fornecedorId, contraparteNome: String(dados.get("contraparte") ?? ""), formaPagamentoId, observacoes: String(dados.get("observacoes") ?? "") });
  }}>
    <div className={`rounded-xl border-l-4 p-3 ${estilo.fundo} ${natureza === "ENTRADA" ? "border-l-success" : "border-l-destructive"}`}><p className={`text-sm font-semibold ${estilo.texto}`}>Nova {transacao.valor < 0 ? "despesa" : "receita"} · {formatarMoeda(Math.abs(transacao.valor))}</p><p className="mt-1 text-xs text-muted-foreground">Será realizada em {dataTexto(transacao.data)}, na conta {contaNome}, e conciliada com esta transação.</p></div>
    <div className="space-y-1.5"><Label htmlFor="descricao-conciliacao">Descrição</Label><Input id="descricao-conciliacao" name="descricao" defaultValue={transacao.descricao.slice(0, 500).toLocaleUpperCase("pt-BR")} maxLength={500} required disabled={pendente} autoCapitalize="characters" onInput={(evento) => aplicarCaixaAltaNoCampo(evento.currentTarget)} /></div>
    <div className="space-y-1.5"><Label>Categoria / plano de contas</Label><CategoriaFinanceiraCombobox categorias={categorias} value={categoriaId} onChange={setCategoriaId} disabled={pendente} ariaLabel="Categoria do novo lançamento" placeholder={transacao.valor < 0 ? "Buscar categoria de despesa..." : "Buscar categoria de receita..."} /><p className="text-xs text-muted-foreground">Define o grupo da DRE e a categoria no fluxo de caixa. O centro de custo segue o cadastro da categoria.</p></div>
    <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="competencia-conciliacao">Competência</Label><Input id="competencia-conciliacao" name="competencia" type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX} required defaultValue={transacao.data} disabled={pendente} /><p className="text-xs text-muted-foreground">Data do fato gerador na DRE.</p></div><div className="space-y-1.5"><Label htmlFor="vencimento-conciliacao">Vencimento</Label><Input id="vencimento-conciliacao" name="vencimento" type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX} required defaultValue={transacao.data} disabled={pendente} /></div></div>
    <div className="space-y-1.5"><label className="grid gap-1.5 text-xs font-medium">Fornecedor ou beneficiário (opcional)<SelecaoFormulario aria-label="Fornecedor ou beneficiário do novo lançamento" value={fornecedorId} onValueChange={(novoValor) => setFornecedorId(novoValor)} disabled={pendente}><option value="">Sem cadastro</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</SelecaoFormulario></label>{podeCadastrarBeneficiario && !pendente && <FornecedorDialog canaisPedidoOptions={[]} formasPagamentoOptions={opcoes.formasPagamento} aoSalvar={(cadastro) => { setBeneficiariosCriados((atuais) => [...atuais.filter((item) => item.id !== cadastro.id), cadastro]); setFornecedorId(cadastro.id); if (cadastro.formaPagamentoId) setFormaPagamentoId(cadastro.formaPagamentoId); }} trigger={<button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><UserPlus className="size-3.5" />Cadastrar fornecedor ou beneficiário</button>} />}</div>
    <div className="space-y-1.5"><Label htmlFor="contraparte-conciliacao">Contraparte / cliente (opcional)</Label><Input id="contraparte-conciliacao" name="contraparte" maxLength={250} disabled={pendente} autoCapitalize="characters" onInput={(evento) => aplicarCaixaAltaNoCampo(evento.currentTarget)} /></div>
    <label className="grid gap-1.5 text-xs font-medium">Forma de pagamento (opcional)<SelecaoFormulario aria-label="Forma de pagamento do novo lançamento" value={formaPagamentoId} onValueChange={(novoValor) => setFormaPagamentoId(novoValor)} disabled={pendente}><option value="">Não informada</option>{opcoes.formasPagamento.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</SelecaoFormulario></label>
    <div className="space-y-1.5"><Label htmlFor="observacoes-conciliacao">Observações (opcional)</Label><Textarea id="observacoes-conciliacao" name="observacoes" maxLength={2000} disabled={pendente} /></div>
    {(erroFormulario || erro) && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{erroFormulario || erro}</p>}
    <div className="flex flex-wrap gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={pendente} onClick={aoVoltar}>Usar existente</Button><Button type="submit" variant={estilo.varianteBotao} className="flex-1" disabled={pendente || !categoriaId}>{pendente ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}Criar e conciliar</Button></div>
  </form>;
}
