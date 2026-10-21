"use client";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelecaoFormulario } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoRemoverItem } from "@/components/remover-item";
import { InsumoCombobox } from "../insumo-combobox";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import type { EntradaDetalheDTO } from "@/lib/inventario/entrada-avulsa-historico";
import type { InsumoOption, LocalOption } from "../types";
import { corrigirEntradaAvulsaAction } from "./actions";

type Linha = { chave: string; insumoId: string | null; localId: string; quantidade: string; fatorConversao: string; unidadeEntrada: string; valorProdutos: string };
const numero = (v: string) => Number(v.replace(",", "."));
const dataHora = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function EntradaAvulsaDetalhe({ detalhe, insumos, locais, podeEditar }: { detalhe: EntradaDetalheDTO; insumos: InsumoOption[]; locais: LocalOption[]; podeEditar: boolean }) {
  const [editar, setEditar] = useState(false);
  const s = detalhe.snapshot;
  return <div className="space-y-5">
    <BarraAcoes titulo={`Entrada ${detalhe.identificador}`} descricao={`${s.tipo === "COMPRA_SIMPLES" ? "Completa" : "Simples"} · ${detalhe.responsavel} · ${dataHora(detalhe.criadoEm)} · Versão ${detalhe.versao || "original"}`}>
      <Button variant="outline" nativeButton={false} render={<Link href="/inventario/entradas" />}>Voltar ao histórico</Button>
      {podeEditar && <Button variant="editar" aria-label="Editar entrada" disabled={!!detalhe.bloqueio} onClick={() => setEditar(true)} />}
    </BarraAcoes>
    {detalhe.bloqueio && <p role="alert" className="text-sm text-muted-foreground">{detalhe.bloqueio}</p>}
    <Card><CardHeader><CardTitle>Itens e informações registradas</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm">Data de entrada: {s.data.split("-").reverse().join("/")} · {s.itens.length} itens{s.fornecedorNome ? ` · ${s.fornecedorNome}` : ""}</p>
      {s.reconstruida && <p className="text-sm text-muted-foreground">Registro anterior: a quantidade comercial e o fator original não foram armazenados. As quantidades abaixo vêm dos movimentos reais, na unidade de estoque; os custos já incluem os rateios originais.</p>}
      <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Local</TableHead><TableHead>Quantidade / unidade de entrada</TableHead><TableHead>Conversão</TableHead><TableHead>Estoque</TableHead><TableHead>Valor rateado</TableHead></TableRow></TableHeader><TableBody>{s.itens.map((i, n) => <TableRow key={`${i.insumoId}-${i.localId}-${n}`}><TableCell>{i.nome}</TableCell><TableCell>{i.localNome}</TableCell><TableCell>{i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 9 })} {i.unidadeEntrada}</TableCell><TableCell>{i.fatorConversao ?? 1}</TableCell><TableCell>{i.quantidadeEstoque} {unidadeMedidaAbreviada[i.unidade]}</TableCell><TableCell>{formatarMoeda(i.valorFinal)}</TableCell></TableRow>)}</TableBody></Table>
      <p className="text-sm">Frete: {formatarMoeda(s.frete)} · Desconto: {formatarMoeda(s.desconto)} · Total: <strong>{formatarMoeda(s.valorTotal)}</strong></p>
      {s.custosAdicionais.map((c, n) => <p key={n} className="text-sm">{c.descricao}: {formatarMoeda(c.valor)}</p>)}
      {s.dadosOriginais && <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">{Object.entries(s.dadosOriginais).map(([campo, valor]) => <div key={campo}><dt className="font-medium">{({ dataVencimento: "Vencimento original", pago: "Pago no registro", dataPagamento: "Pagamento original", formaPagamento: "Forma de pagamento", contaBancariaId: "Conta de origem", cartaoCreditoId: "Cartão de origem", dataCompra: "Compra no cartão", parcelaCartao: "Parcela", frete: "Frete original", desconto: "Desconto original", outrosCustos: "Custos originais" } as Record<string, string>)[campo] ?? campo}</dt><dd className="break-words">{typeof valor === "boolean" ? valor ? "Sim" : "Não" : valor ?? "—"}</dd></div>)}</dl>}
      <p className="whitespace-pre-wrap text-sm">{s.observacao || "Sem observação."}</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Histórico de versões</CardTitle></CardHeader><CardContent className="space-y-4">
      {!detalhe.versoes.length && <p className="text-sm text-muted-foreground">Registro original, sem correções.</p>}
      {detalhe.versoes.map(v => <div key={v.versao} className="space-y-2 border-b pb-4 last:border-0"><p className="text-sm font-medium">Versão {v.versao} · {v.autorNome} · {dataHora(v.data)}</p>
        {!v.diferencas.length ? <p className="text-xs text-muted-foreground">Registro original preservado.</p> : <Table><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Anterior</TableHead><TableHead>Novo</TableHead></TableRow></TableHeader><TableBody>{v.diferencas.map((d, n) => <TableRow key={n}><TableCell>{d.campo}</TableCell><TableCell className="whitespace-normal">{d.anterior}</TableCell><TableCell className="whitespace-normal">{d.novo}</TableCell></TableRow>)}</TableBody></Table>}
        {v.ajustes.length > 0 && <p className="break-words text-xs text-muted-foreground">Movimentos vinculados: {v.ajustes.map(a => a.movimentoId).join(", ")}</p>}
      </div>)}
    </CardContent></Card>
    <EntradaAvulsaEdicaoDialog detalhe={detalhe} insumos={insumos} locais={locais} aberto={editar} aoFechar={() => setEditar(false)} />
  </div>;
}

export function EntradaAvulsaEdicaoDialog({ detalhe, insumos, locais, aberto, aoFechar }: { detalhe: EntradaDetalheDTO; insumos: InsumoOption[]; locais: LocalOption[]; aberto: boolean; aoFechar: () => void }) {
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const s = detalhe.snapshot;
  const catalogo = [...new Map([...s.itens.map(i => ({ id: i.insumoId, nome: i.nome, unidade: i.unidade })), ...insumos].map(i => [i.id, i])).values()];
  return <Dialog open={aberto} alterado={alterado} protegerAlteracoes={!salvando} onOpenChange={aberto => { if (!aberto && !salvando) aoFechar(); }}><DialogContent className="sm:max-w-5xl" showCloseButton={!salvando}><DialogHeader><DialogTitle>Editar entrada avulsa {detalhe.identificador}</DialogTitle><DialogDescription>{s.data.split("-").reverse().join("/")} · {s.fornecedorNome ?? "Entrada simples"} · {detalhe.responsavel}. Os movimentos e as versões anteriores serão preservados.</DialogDescription></DialogHeader>
    {aberto && <EditorEntrada key={`${detalhe.id}-${detalhe.versao}`} detalhe={detalhe} insumos={catalogo} locais={locais} aoConcluir={aoFechar} aoSalvar={setSalvando} aoAlterar={setAlterado} />}
  </DialogContent></Dialog>;
}

function EditorEntrada({ detalhe, insumos, locais, aoConcluir, aoSalvar, aoAlterar }: { detalhe: EntradaDetalheDTO; insumos: InsumoOption[]; locais: LocalOption[]; aoConcluir: () => void; aoSalvar: (salvando: boolean) => void; aoAlterar: (alterado: boolean) => void }) {
  const s = detalhe.snapshot;
  const router = useRouter();
  const [itens, setItens] = useState<Linha[]>(() => s.itens.map((i, n) => ({ chave: `original-${n}`, insumoId: i.insumoId, localId: i.localId, quantidade: String(i.quantidade), fatorConversao: String(i.fatorConversao ?? 1), unidadeEntrada: i.unidadeEntrada ?? i.unidade, valorProdutos: String(i.valorProdutos) })));
  const [observacao, setObservacao] = useState(s.observacao ?? "");
  const [frete, setFrete] = useState(String(s.frete));
  const [desconto, setDesconto] = useState(String(s.desconto));
  const [custos, setCustos] = useState(() => s.custosAdicionais.map((c, n) => ({ ...c, chave: `custo-${n}`, valor: String(c.valor) })));
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trava = useRef(false);
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const [focar, setFocar] = useState<string | null>(null);
  const rascunho = JSON.stringify({ itens: itens.map(i => ({ insumoId: i.insumoId, localId: i.localId, quantidade: i.quantidade, fatorConversao: i.fatorConversao, unidadeEntrada: i.unidadeEntrada, valorProdutos: i.valorProdutos })), observacao, frete, desconto, custos: custos.map(c => ({ descricao: c.descricao, valor: c.valor })) });
  const baseRascunho = useRef(rascunho);
  useEffect(() => { aoAlterar(rascunho !== baseRascunho.current); }, [rascunho, aoAlterar]);
  const atualizar = (chave: string, dados: Partial<Linha>) => setItens(atuais => atuais.map(i => i.chave === chave ? { ...i, ...dados } : i));
  function salvar() {
    if (trava.current) return;
    trava.current = true; setErro(null); aoSalvar(true);
    const dados = { id: detalhe.id, versao: detalhe.versao, itens: itens.map(i => ({ insumoId: i.insumoId ?? "", localId: i.localId, quantidade: numero(i.quantidade), fatorConversao: numero(i.fatorConversao), unidadeEntrada: i.unidadeEntrada, valorProdutos: numero(i.valorProdutos) })), observacao: observacao.trim() || null, frete: numero(frete), desconto: numero(desconto), custosAdicionais: custos.map(c => ({ descricao: c.descricao, valor: numero(c.valor) })) };
    const assinatura = JSON.stringify(dados);
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    startTransition(async () => {
      try {
        const r = await corrigirEntradaAvulsaAction({ ...dados, chave: tentativa.current!.chave });
        if ("erro" in r) { setErro(r.erro); return; }
        aoConcluir(); router.refresh();
      } catch { setErro("Não foi possível confirmar. Tente novamente; a mesma correção não será duplicada."); }
      finally { trava.current = false; aoSalvar(false); }
    });
  }
  return <fieldset disabled={pending} className="min-w-0 space-y-4">
    <p className="text-xs text-muted-foreground">{s.tipo === "COMPRA_SIMPLES" ? `Total financeiro original: ${formatarMoeda(s.valorTotal)}. Preserve esse total ao corrigir os valores dos itens.` : "A correção será aplicada ao estoque atual sem gerar despesa."}</p>
    <div ref={topo} className="space-y-3">
      {itens.map((i, n) => <Fragment key={i.chave}><div className="space-y-3 rounded-xl border p-3" ref={el => { if (el && focar === i.chave) { el.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus(); setFocar(null); } }}>
        <div className="flex items-center justify-between"><p className="text-sm font-medium">Item {n + 1}</p><BotaoRemoverItem nome={`Remover item ${n + 1}`} disabled={pending || itens.length === 1} onClick={() => setItens(a => a.filter(item => item.chave !== i.chave))} /></div>
        <div data-campos-edicao className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)_minmax(0,.9fr)_minmax(0,.75fr)_minmax(0,1fr)]">
          <div className="space-y-1.5"><Label>Produto</Label><InsumoCombobox insumos={insumos} value={i.insumoId} onChange={insumoId => atualizar(i.chave, { insumoId, unidadeEntrada: insumos.find(p => p.id === insumoId)?.unidade ?? "", fatorConversao: "1" })} disabled={pending} /></div>
          <div className="space-y-1.5"><Label htmlFor={`local-edicao-${i.chave}`}>Local</Label><SelecaoFormulario id={`local-edicao-${i.chave}`} value={i.localId} onValueChange={localId => atualizar(i.chave, { localId })} disabled={pending}><option value="">Selecione</option>{locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</SelecaoFormulario></div>
          <div className="space-y-1.5"><Label htmlFor={`quantidade-edicao-${i.chave}`}>Qtd</Label><InputComSufixo id={`quantidade-edicao-${i.chave}`} aria-label={`Quantidade do item ${n + 1}`} value={i.quantidade} inputMode="decimal" casasDecimais={6} maxLength={16} sufixo={i.unidadeEntrada || "—"} onChange={e => atualizar(i.chave, { quantidade: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor={`fator-edicao-${i.chave}`}>Fator</Label><Input id={`fator-edicao-${i.chave}`} value={i.fatorConversao} inputMode="decimal" casasDecimais={6} maxLength={16} onChange={e => atualizar(i.chave, { fatorConversao: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Valor</Label><CurrencyInput aria-label={`Valor do item ${n + 1}`} value={i.valorProdutos} onValueChange={valorProdutos => atualizar(i.chave, { valorProdutos })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Unidade de estoque: {insumos.find(p => p.id === i.insumoId)?.unidade ?? "—"}. O fator converte a unidade de entrada para estoque.</p>
      </div>{n === 0 && <Button variant="outline" disabled={pending || itens.length >= 100} onClick={() => { const chave = crypto.randomUUID(); setFocar(chave); setItens(a => [{ chave, insumoId: null, localId: locais.length === 1 ? locais[0].id : "", quantidade: "", fatorConversao: "1", unidadeEntrada: "", valorProdutos: "" }, ...a]); topo.current?.scrollIntoView?.({ block: "start" }); }}><Plus />Adicionar item</Button>}</Fragment>)}
    </div>
    {s.tipo === "COMPRA_SIMPLES" && <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Frete</Label><CurrencyInput aria-label="Frete da correção" value={frete} onValueChange={setFrete} /></div><div className="space-y-1.5"><Label>Desconto</Label><CurrencyInput aria-label="Desconto da correção" value={desconto} onValueChange={setDesconto} /></div></div>
      {custos.map((c, n) => <div key={c.chave} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><Input aria-label={`Descrição do custo ${n + 1}`} maxLength={120} value={c.descricao} onChange={e => setCustos(a => a.map(x => x.chave === c.chave ? { ...x, descricao: e.target.value } : x))} /><CurrencyInput aria-label={`Valor do custo ${n + 1}`} value={c.valor} onValueChange={valor => setCustos(a => a.map(x => x.chave === c.chave ? { ...x, valor } : x))} /><BotaoRemoverItem nome={`Remover custo ${n + 1}`} onClick={() => setCustos(a => a.filter(x => x.chave !== c.chave))} /></div>)}
      <Button variant="outline" disabled={custos.length >= 20} onClick={() => setCustos(a => [...a, { chave: crypto.randomUUID(), descricao: "", valor: "" }])}>Adicionar custo</Button>
    </div>}
    <div className="space-y-1.5"><Label htmlFor="observacao-correcao">Observação / motivo</Label><Textarea id="observacao-correcao" maxLength={2000} value={observacao} onChange={e => setObservacao(e.target.value)} /></div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <GrupoAcoes nome="Correção da entrada" className="flex-wrap border-t py-3">
      <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancelar</DialogClose><Button variant="entrada" disabled={pending} onClick={salvar}>{pending ? "Salvando…" : "Salvar correção"}</Button>
    </GrupoAcoes>
  </fieldset>;
}
