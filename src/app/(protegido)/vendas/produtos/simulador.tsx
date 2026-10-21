"use client";
import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantidadeEscolha } from "@/components/quantidade-escolha";
import { limiteQuantidadeEscolha } from "@/lib/vendas/escolhas-grupo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { limitesEfetivos, opcoesEfetivas, type ProdutoEntrada } from "@/lib/vendas/dominio";
import { precosOpcoes } from "@/lib/vendas/complementos";
import { resolverConfiguracao } from "@/lib/vendas/configuracao";
import type { DadosProdutos } from "@/lib/vendas/consultas";
import { PreviaFichaProduto } from "./previa-ficha";
const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function Simulador({ produto, dados, fechar }: { produto: ProdutoEntrada; dados: DadosProdutos; fechar: () => void }) {
  const [escolhas, setEscolhas] = useState<Record<string, number>>({}); const [ficha, setFicha] = useState(false);
  const grupos = produto.grupos.flatMap(v => { const g = dados.grupos.find(g => g.id === v.grupoId); return g ? [{ ...g, opcoes: opcoesEfetivas(precosOpcoes(g.opcoes, dados.produtos), v), vinculo: v }] : []; });
  const resultado = resolverConfiguracao(produto, dados, escolhas);
  return <><Dialog open protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto) fechar(); }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{produto.nome}</DialogTitle><DialogDescription>Valide preços e escolhas. A simulação não cria pedido, reserva ou baixa de estoque.</DialogDescription></DialogHeader>
    {grupos.filter(g => g.ativo).map(g => { const limites = limitesEfetivos(g, g.vinculo); const total = g.opcoes.filter(o => o.ativo).reduce((s, o) => s + (escolhas[o.id] ?? 0), 0); const invalido = total < limites.minimo || (limites.maximo !== null && total > limites.maximo) || !Number.isSafeInteger(total); return <section key={g.id} className={`space-y-2 rounded-xl border p-3 ${invalido ? "border-destructive bg-destructive/5" : ""}`}><h3 className="text-sm font-semibold">{g.nome} <span className="font-normal text-muted-foreground">· {limites.minimo ? `Mín. ${limites.minimo}` : "Opcional"} · {limites.maximo === null ? "Sem limite" : `Máx. ${limites.maximo}`} · {total} selecionada(s)</span></h3>{!g.opcoes.some(o => o.ativo) && <p className="text-xs text-muted-foreground">Nenhuma opção ativa cadastrada.</p>}{g.opcoes.filter(o => o.ativo).map(o => <div key={o.id} className="flex items-center gap-3 py-1 text-sm"><span className="min-w-0 flex-1">{o.nome}</span><span className="shrink-0 text-muted-foreground">{Number(o.preco) ? moeda(Number(o.preco)) : "Incluído"}</span><QuantidadeEscolha nome={`Quantidade de ${o.nome}`} valor={escolhas[o.id] ?? 0} maximo={limiteQuantidadeEscolha(g.opcoes.filter(opcao => opcao.ativo), escolhas, o.id, limites.maximo, g.repetir)} alterar={quantidade => setEscolhas({ ...escolhas, [o.id]: quantidade })} /></div>)}</section>; })}
    <div className="sticky bottom-0 space-y-2 rounded-xl border bg-background p-4"><div className="flex justify-between font-semibold"><span>Total da configuração</span><span>{Number.isSafeInteger(resultado.totalCentavos) ? moeda(resultado.totalCentavos / 100) : "Inválido"}</span></div>{resultado.erros.map((e, i) => <p key={i} role="alert" className="text-xs text-destructive">{e}</p>)}{resultado.valido && <p className="text-xs text-primary">Configuração comercial válida</p>}<p className="text-xs text-muted-foreground">Custo teórico: {resultado.custo == null ? "pendente de composição/custo" : moeda(resultado.custo)}. Não inclui taxas, frete ou tributos da venda.</p>{resultado.pendencias.length > 0 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Ver {resultado.pendencias.length} pendência(s) de composição</summary>{resultado.pendencias.map((p, i) => <p key={i}>{p}</p>)}</details>}<Button variant="outline" disabled={!resultado.valido} onClick={() => setFicha(true)}><Eye className="size-4" />Ver ficha desta configuração</Button></div>
  {ficha && <PreviaFichaProduto produto={produto} dados={dados} configuracao={{ escolhas }} fechar={() => setFicha(false)} />}</DialogContent></Dialog></>;
}
