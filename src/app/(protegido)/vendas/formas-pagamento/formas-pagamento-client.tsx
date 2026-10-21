"use client";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";

import { useFracaoMascarada } from "@/components/use-fracao-mascarada";
import { useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusCadastroVenda } from "../status-cadastro";
import { CurrencyInput } from "@/components/ui/currency-input";
import { CabecalhoVendas, Campo, Check, EditorVenda, Texto, Vazio, classeSelecao } from "../componentes";
import { salvarFormaPagamentoVendaAction } from "./actions";
import { TIPOS_FORMA_PAGAMENTO, taxasNaParcela, type FormaPagamentoVendaEntrada, type FaixaTaxaVenda, type TipoFormaPagamentoVenda } from "@/lib/vendas/formas-pagamento";

const novaForma = (): FormaPagamentoVendaEntrada => ({
  id: "", versao: 0, nome: "", tipo: "PIX", taxaPercentual: "0", taxaFixa: "0",
  prazoDias: 0, inicioPrazo: "PAGAMENTO", contagemPrazo: "CORRIDOS", vencimentoFlexivel: false,
  permiteParcelamento: false, maximoParcelas: 1, faixasTaxa: [], observacoes: null, ativo: true,
});
const moeda = (valor: string | number) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percentual = (valor: string | number) => `${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
function resumoTaxa(forma: FormaPagamentoVendaEntrada) {
  const partes = [];
  if (Number(forma.taxaPercentual)) partes.push(percentual(forma.taxaPercentual));
  if (Number(forma.taxaFixa)) partes.push(moeda(forma.taxaFixa));
  return partes.join(" + ") || "Sem taxa";
}
function resumoPrazo(forma: FormaPagamentoVendaEntrada) {
  if (forma.prazoDias === 0) return "Recebimento imediato";
  const dias = forma.prazoDias === 1
    ? (forma.contagemPrazo === "UTEIS" ? "dia útil" : "dia corrido")
    : (forma.contagemPrazo === "UTEIS" ? "dias úteis" : "dias corridos");
  return `${forma.vencimentoFlexivel ? "Até " : "Em "}${forma.prazoDias} ${dias} após ${forma.inicioPrazo === "PAGAMENTO" ? "o pagamento" : "a venda"}`;
}

/** Digitação numérica com vírgula implícita, como os demais valores do sistema. */
function CampoPercentual({ valor, alterar, descricao }: { valor: string; alterar: (valor: string) => void; descricao: string }) {
  const fracao = useFracaoMascarada(valor, alterar, 5);
  const exibido = valor === "" ? "" : Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <div className="relative">
    <Input aria-label={descricao} inputMode="numeric" value={fracao.texto ?? exibido} className="pr-9" placeholder="0,00"
      onPaste={e => { fracao.aoColar(e); }} onBlur={fracao.aoSair}
      onKeyDown={e => { if (fracao.aoTeclar(e)) return; if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault(); }}
      onChange={e => {
        if (fracao.aoEditar(e)) return;
        const digitos = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 5);
        alterar(digitos ? (Number(digitos) / 100).toFixed(2) : "");
      }} />
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
  </div>;
}

export function FormasPagamentoVenda({ formas, adicionar, editar }: { formas: FormaPagamentoVendaEntrada[]; adicionar: boolean; editar: boolean }) {
  const [selecionada, selecionar] = useState<FormaPagamentoVendaEntrada | null>(null);
  const [mostrarInativas, definirMostrarInativas] = useState(false);
  const visiveis = formas.filter(forma => mostrarInativas || forma.ativo);
  const ativas = formas.filter(forma => forma.ativo).length;
  return <div className="space-y-5">
    <CabecalhoVendas titulo="Formas de pagamento" descricao="Defina as taxas e quando o valor de cada venda poderá ser recebido.">
      {adicionar && <Button onClick={() => selecionar(novaForma())}><Plus className="size-4" />Nova forma</Button>}
    </CabecalhoVendas>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">{ativas} {ativas === 1 ? "forma ativa" : "formas ativas"}</p>
      <FiltroOpcoesContadas nome="Situação das formas de pagamento" valor={mostrarInativas ? "TODAS" : "ATIVAS"}
        onValueChange={valor => definirMostrarInativas(valor === "TODAS")} opcoes={[
          { valor: "ATIVAS", nome: "Ativas", quantidade: ativas }, { valor: "TODAS", nome: "Todas", quantidade: formas.length },
        ]} />
    </div>
    {!visiveis.length ? <Vazio>Nenhuma forma de pagamento {mostrarInativas ? "cadastrada" : "ativa"}.</Vazio> : <div className="grid gap-3 lg:grid-cols-2">
      {visiveis.map(forma => <article key={forma.id} className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CreditCard className="size-5" /></span><div className="min-w-0"><h2 className="truncate font-semibold">{forma.nome}</h2><p className="text-xs text-muted-foreground">{TIPOS_FORMA_PAGAMENTO[forma.tipo]}</p></div></div><GrupoAcoes><StatusCadastroVenda tipo="FORMA_PAGAMENTO" id={forma.id} versao={forma.versao} ativo={forma.ativo} nome={forma.nome} editar={editar} />{editar && <Button aria-label={`Editar ${forma.nome}`} onClick={() => selecionar(structuredClone(forma))} variant="editar" size="icon-sm" />}</GrupoAcoes></div>
        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Taxa por recebimento</p><p className="mt-1 font-semibold tabular-nums">{resumoTaxa(forma)}</p></div><div><p className="text-xs text-muted-foreground">Prazo</p><p className="mt-1 text-sm font-medium">{resumoPrazo(forma)}</p></div></div>
        {forma.permiteParcelamento && <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Até {forma.maximoParcelas} parcelas{forma.faixasTaxa.length ? ` · ${forma.faixasTaxa.length} faixa(s) de taxa extra` : " · sem taxa extra por parcela"}</div>}
      </article>)}
    </div>}
    {selecionada && <EditorForma key={`${selecionada.id}-${selecionada.versao}`} inicial={selecionada} fechar={() => selecionar(null)} />}
  </div>;
}

function EditorForma({ inicial, fechar }: { inicial: FormaPagamentoVendaEntrada; fechar: () => void }) {
  const [d, definir] = useState(inicial);
  const campo = <K extends keyof FormaPagamentoVendaEntrada>(chave: K, valor: FormaPagamentoVendaEntrada[K]) => definir(atual => ({ ...atual, [chave]: valor }));
  const faixa = (indice: number, valores: Partial<FaixaTaxaVenda>) => campo("faixasTaxa", d.faixasTaxa.map((item, i) => i === indice ? { ...item, ...valores } : item));
  const proximaParcela = Math.max(2, ...d.faixasTaxa.map(f => f.ate + 1));
  return <EditorVenda titulo={d.id ? "Editar forma de pagamento" : "Nova forma de pagamento"} descricao="Cadastre as condições cobradas pelo meio de pagamento. As taxas extras somam-se à taxa principal." fechar={fechar} salvar={() => salvarFormaPagamentoVendaAction(d)}>
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]"><Texto nome="Nome *" required maxLength={120} placeholder="Ex.: Cartão de crédito online" value={d.nome} onChange={e => campo("nome", e.target.value)} /><Campo nome="Tipo"><SelecaoFormulario aria-label="Tipo"  value={d.tipo} onValueChange={valor => campo("tipo", valor as TipoFormaPagamentoVenda)}>{Object.entries(TIPOS_FORMA_PAGAMENTO).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</SelecaoFormulario></Campo></div>
    <section className="space-y-3 rounded-xl border p-4"><div><h3 className="font-semibold">Taxas por recebimento</h3><p className="text-xs text-muted-foreground">Percentual sobre o valor cobrado e valor fixo por transação recebida. Podem ser combinados.</p></div><div className="grid gap-3 sm:grid-cols-2"><Campo nome="Taxa percentual"><CampoPercentual descricao="Taxa percentual" valor={d.taxaPercentual} alterar={v => campo("taxaPercentual", v)} /></Campo><Campo nome="Taxa fixa (R$)"><CurrencyInput aria-label="Taxa fixa" value={d.taxaFixa} onValueChange={v => campo("taxaFixa", v)} /></Campo></div></section>
    <section className="space-y-3 rounded-xl border p-4"><div><h3 className="font-semibold">Prazo de recebimento</h3><p className="text-xs text-muted-foreground">A contagem começa na venda ou após a confirmação do pagamento.</p></div><div className="grid gap-3 sm:grid-cols-3"><Texto nome="Prazo (dias) *" type="number" inputMode="numeric" min={0} max={3650} step={1} required value={d.prazoDias} onChange={e => {
      const dias = Number(e.target.value);
      definir(atual => ({ ...atual, prazoDias: dias, vencimentoFlexivel: dias === 0 ? false : atual.vencimentoFlexivel }));
    }} /><Campo nome="Contagem"><SelecaoFormulario aria-label="Contagem"  value={d.contagemPrazo} onValueChange={valor => campo("contagemPrazo", valor as "CORRIDOS" | "UTEIS")}><option value="CORRIDOS">Dias corridos</option><option value="UTEIS">Dias úteis</option></SelecaoFormulario></Campo><Campo nome="A partir de"><SelecaoFormulario aria-label="A partir de"  value={d.inicioPrazo} onValueChange={valor => campo("inicioPrazo", valor as "VENDA" | "PAGAMENTO")}><option value="PAGAMENTO">Pagamento confirmado</option><option value="VENDA">Data da venda</option></SelecaoFormulario></Campo></div><Check checked={d.vencimentoFlexivel} disabled={d.prazoDias === 0} onChange={e => campo("vencimentoFlexivel", e.target.checked)}>Permitir escolher o vencimento na venda, até o prazo máximo</Check>{d.vencimentoFlexivel && <p className="text-xs text-muted-foreground">O prazo informado será o limite. O vencimento escolhido deverá ficar entre a data inicial e esse limite.</p>}</section>
    <section className="space-y-3 rounded-xl border p-4"><div><h3 className="font-semibold">Parcelamento</h3><p className="text-xs text-muted-foreground">As faixas são opcionais. Sem faixa, vale a taxa principal para qualquer quantidade de parcelas.</p></div><Check checked={d.permiteParcelamento} onChange={e => definir(atual => ({ ...atual, permiteParcelamento: e.target.checked, maximoParcelas: e.target.checked ? Math.max(2, atual.maximoParcelas) : 1, faixasTaxa: e.target.checked ? atual.faixasTaxa : [] }))}>Permitir parcelamento</Check>
      {d.permiteParcelamento && <div className="space-y-3"><div className="max-w-48"><Texto nome="Máximo de parcelas *" type="number" inputMode="numeric" min={2} max={120} step={1} required value={d.maximoParcelas} onChange={e => campo("maximoParcelas", Number(e.target.value))} /></div>
        <Button type="button" variant="outline" size="sm" data-dialogo-altera disabled={d.faixasTaxa.length >= 30 || proximaParcela > d.maximoParcelas} onClick={() => campo("faixasTaxa", [{ de: proximaParcela, ate: d.maximoParcelas, percentual: "0", fixa: "0" }, ...d.faixasTaxa])}><Plus className="size-4" />Adicionar faixa de taxa extra</Button>
    {d.faixasTaxa.map((f, i) => <div key={i} className="rounded-xl bg-muted/40 p-3"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium">Faixa {i + 1}</p><Button variant="excluir" size="icon-sm" aria-label={`Remover faixa ${i + 1}`} data-dialogo-altera onClick={() => campo("faixasTaxa", d.faixasTaxa.filter((_, indice) => indice !== i))} /></div><div className="grid gap-3 sm:grid-cols-4"><Texto nome="De" type="number" min={1} max={120} step={1} required value={f.de} onChange={e => faixa(i, { de: Number(e.target.value) })} /><Texto nome="Até" type="number" min={1} max={120} step={1} required value={f.ate} onChange={e => faixa(i, { ate: Number(e.target.value) })} /><Campo nome="Extra (%)"><CampoPercentual descricao={`Taxa extra percentual da faixa ${i + 1}`} valor={f.percentual} alterar={v => faixa(i, { percentual: v })} /></Campo><Campo nome="Extra (R$)"><CurrencyInput aria-label={`Taxa extra fixa da faixa ${i + 1}`} value={f.fixa} onValueChange={v => faixa(i, { fixa: v })} /></Campo></div></div>)}

        {d.faixasTaxa.length > 0 && proximaParcela > d.maximoParcelas && <p className="text-xs text-muted-foreground">Para adicionar outra faixa, reduza o campo “Até” da faixa que termina no máximo de parcelas.</p>}
        {d.faixasTaxa.length > 0 && <p className="text-xs text-muted-foreground">Exemplo: {d.faixasTaxa[0].de} a {d.faixasTaxa[0].ate} parcelas: {percentual(taxasNaParcela(d, d.faixasTaxa[0].de).percentual)} + {moeda(taxasNaParcela(d, d.faixasTaxa[0].de).fixa)} no total.</p>}
      </div>}
    </section>
    <Campo nome="Observações"><textarea className={`${classeSelecao} h-20 py-2`} maxLength={1000} value={d.observacoes ?? ""} onChange={e => campo("observacoes", e.target.value)} placeholder="Condições do provedor, exceções ou referência do contrato" /></Campo>
    <Check checked={d.ativo} onChange={e => campo("ativo", e.target.checked)}>Forma de pagamento ativa</Check>
  </EditorVenda>;
}
