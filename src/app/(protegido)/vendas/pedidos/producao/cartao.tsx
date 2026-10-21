"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { estadosOperacao, type ComandoOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import { FisicoPedido, type ResumoFisico } from "../[id]/operacao/fisico-client";
import { produzirPedidoAction } from "./actions";
export type CartaoProducao = { id: string; numero: number; versao: number; statusOperacional: string; entrega: string; observacoes: string | null; atraso: boolean; revisoes: { versao: number; descricao: string }[]; ocorrencias: string[]; itens: { id: string; nome: string; quantidade: string; unidade: string; observacoes?: string | null; preparado: string; restante: string; opcoes: string; pendencia: boolean }[] };
export function AtualizarProducao() {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? "")) router.refresh(); }, 30000); return () => clearInterval(t); }, [router]);
  return <Button variant="outline" onClick={() => router.refresh()}>Atualizar fila</Button>;
}
export function PedidoProducao({ p, editar, expedir, materiais }: { materiais?: { locais: { id: string; nome: string }[]; reservas: ResumoFisico[] }; p: CartaoProducao; editar: boolean; expedir: boolean }) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [erro, setErro] = useState(""), [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const chaves = useRef<Record<string, string>>({});
  function executar(comando: ComandoOperacao) {
    const assinatura = JSON.stringify(comando), chave = chaves.current[assinatura] ??= crypto.randomUUID();
    iniciar(async () => { setErro(""); try { const r = await produzirPedidoAction(p.id, p.versao, comando, chave); if ("erro" in r) setErro(r.erro ?? "Falha na operação."); else router.refresh(); } catch { setErro("Resultado não confirmado; atualize a fila antes de repetir."); } });
  }
  return <article className="space-y-4 rounded-2xl border bg-card p-4"><header><h2 className="text-title font-semibold">#{p.numero} · {p.entrega}</h2><p className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={p.statusOperacional === "ENTREGUE" ? "success" : p.statusOperacional === "PENDENTE" ? "warning" : "secondary"}>{estadosOperacao[p.statusOperacional]}</Badge><span className="text-sm text-muted-foreground">Revisão {p.versao}</span></p>{p.atraso && <p className="mt-2 font-semibold text-destructive">Entrega atrasada pelo prazo cadastrado</p>}</header>
    {erro && <p role="alert" className="rounded-xl border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}<p className="whitespace-pre-wrap">{p.observacoes}</p>
    {p.itens.map(i => <section key={i.id} className="space-y-2 border-t pt-3"><h3 className="font-semibold">{i.quantidade} {i.unidade} · {i.nome}</h3><p className="text-sm">{i.opcoes}</p>{i.observacoes && <p className="whitespace-pre-wrap text-sm">Observação do produto: {i.observacoes}</p>}<p>Preparado: {i.preparado} · Restante: {i.restante}</p>{i.pendencia && <p className="text-sm text-muted-foreground">Composição pendente. Consumo e custo não apurados; acesse o atendimento para completar o cadastro.</p>}{editar && p.statusOperacional === "EM_PREPARO" && Number(i.restante) > 0 && <div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm">Quantidade preparada — {i.nome}<Input inputMode="decimal" value={quantidades[i.id] ?? ""} onChange={e => setQuantidades({ ...quantidades, [i.id]: e.target.value })} /></label><Button disabled={ocupado} onClick={() => executar({ tipo: "PREPARAR", itemId: i.id, quantidade: (quantidades[i.id] ?? "").replace(",", ".") })}>Registrar preparo parcial</Button></div>}</section>)}
    {materiais && <details><summary className="cursor-pointer font-semibold">Materiais: reservar e registrar utilização</summary><FisicoPedido producao id={p.id} versao={p.versao} editar={editar} locais={materiais.locais} itens={p.itens.map(i => ({ id: i.id, nome: i.nome }))} reservas={materiais.reservas} /></details>}
    {p.ocorrencias.map((o, n) => <p key={n} className="rounded-lg border p-2">Ocorrência: {o}</p>)}
    {p.revisoes.map(r => <p key={r.versao} className="text-sm text-muted-foreground">Revisão {r.versao}: {r.descricao}</p>)}
    <div className="flex flex-wrap gap-3">{editar && p.statusOperacional === "PENDENTE" && <Button disabled={ocupado} onClick={() => executar({ tipo: "INICIAR" })}>Iniciar preparação</Button>}{editar && p.statusOperacional === "EM_PREPARO" && <Button disabled={ocupado} onClick={() => executar({ tipo: "PRONTO" })}>Concluir preparação</Button>}<Button variant="outline" nativeButton={false} render={<Link href={`/vendas/pedidos/${p.id}/comanda`} />}>Comanda</Button>{expedir && <Button variant="outline" nativeButton={false} render={<Link href={`/vendas/pedidos/${p.id}/operacao`} />}>Materiais e expedição</Button>}</div>
  </article>;
}
