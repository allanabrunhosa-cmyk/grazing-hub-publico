"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPedidoBadge } from "./status-badge";
import { dataISO, diasCalendario } from "./calendario";
import { formatarNumeroPedido, statusExibicaoLabels, statusExibicaoPedido, type PedidoRow, type StatusExibicaoPedido } from "./types";
import { coresStatusPedido } from "./cores-status";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PedidosCalendario({ pedidos, onSelecionar, onNovoPedido, onReagendar, salvando = false }: {
  pedidos: PedidoRow[];
  onSelecionar: (pedido: PedidoRow) => void;
  onNovoPedido?: (data: string) => void;
  onReagendar?: (pedido: PedidoRow, data: string) => void;
  salvando?: boolean;
}) {
  const [referencia, setReferencia] = useState(() => new Date());
  const [modo, setModo] = useState<"semana" | "mes">("mes");
  const arrastando = useRef<string | null>(null);
  const bloquearClique = useRef(false);
  const [destino, definirDestino] = useState<string | null>(null);
  function criarNoDia(data: string) {
    if (!salvando && !bloquearClique.current) onNovoPedido?.(data);
  }
  const hoje = dataISO(new Date());
  const dias = diasCalendario(referencia, modo);
  const porDia = useMemo(() => {
    const mapa = new Map<string, PedidoRow[]>();
    for (const pedido of pedidos) {
      if (!pedido.previsaoEntrega || pedido.excluidoEm) continue;
      const chave = pedido.previsaoEntrega.slice(0, 10);
      mapa.set(chave, [...(mapa.get(chave) ?? []), pedido]);
    }
    return mapa;
  }, [pedidos]);
  const semData = pedidos.filter(p => !p.previsaoEntrega && !p.excluidoEm);
  const titulo = modo === "mes" ? referencia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : dias[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " a " + dias[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  function navegar(direcao: number) {
    setReferencia(atual => modo === "mes" ? new Date(atual.getFullYear(), atual.getMonth() + direcao, 1) : new Date(atual.getFullYear(), atual.getMonth(), atual.getDate() + direcao * 7));
  }
  function cartao(pedido: PedidoRow) {
    const status = statusExibicaoPedido(pedido, hoje);
    const podeArrastar = !!onReagendar && !salvando && pedido.status === "CONFIRMADO" && !pedido.excluidoEm;
    return <button key={pedido.id} type="button" disabled={salvando}
      draggable={podeArrastar}
      onPointerDown={() => { bloquearClique.current = false; }}
      onKeyDown={() => { bloquearClique.current = false; }}
      onClick={evento => { evento.stopPropagation(); if (!bloquearClique.current) onSelecionar(pedido); }}
      onDragStart={evento => {
        if (!podeArrastar) { evento.preventDefault(); return; }
        arrastando.current = pedido.id;
        bloquearClique.current = true;
        evento.dataTransfer.effectAllowed = "move";
        evento.dataTransfer.setData("text/plain", pedido.id);
      }}
      onDragEnd={() => { arrastando.current = null; definirDestino(null); }}
      aria-label={formatarNumeroPedido(pedido.numero) + " — " + pedido.fornecedorNome + " — " + statusExibicaoLabels[status]}
      title={`${pedido.fornecedorNome} ${formatarNumeroPedido(pedido.numero)} · ${statusExibicaoLabels[status]}`}
      className={"flex h-8 w-full min-w-0 items-center gap-1 rounded-md border px-2 text-left text-xs font-semibold hover:brightness-110 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " + (podeArrastar ? "cursor-grab active:cursor-grabbing " : "") + coresStatusPedido[status]}>
      <span className="min-w-0 truncate">{pedido.fornecedorNome}</span>
      <span className="shrink-0">{formatarNumeroPedido(pedido.numero)}</span>
    </button>;
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label={modo === "mes" ? "Mês anterior" : "Semana anterior"} onClick={() => navegar(-1)}><ChevronLeft /></Button>
        <h2 aria-live="polite" className="min-w-40 text-center text-base font-semibold capitalize">{titulo}</h2>
        <Button variant="outline" size="icon" aria-label={modo === "mes" ? "Próximo mês" : "Próxima semana"} onClick={() => navegar(1)}><ChevronRight /></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setReferencia(new Date())}>Hoje</Button>
        <div role="group" aria-label="Período do calendário" className="flex gap-1 rounded-xl border bg-card p-1">
          <Button size="sm" aria-pressed={modo === "semana"} variant={modo === "semana" ? "default" : "ghost"} onClick={() => setModo("semana")}>Semanal</Button>
          <Button size="sm" aria-pressed={modo === "mes"} variant={modo === "mes" ? "default" : "ghost"} onClick={() => setModo("mes")}>Mensal</Button>
        </div>
      </div>
    </div>
    <div aria-label="Legenda dos status" className="flex flex-wrap gap-2">{Object.keys(coresStatusPedido).map(s => <StatusPedidoBadge key={s} status={s as StatusExibicaoPedido} />)}</div>
    {onNovoPedido && <p className="text-xs text-muted-foreground">Clique no espaço livre de um dia para criar um pedido. Arraste pedidos pendentes para mudar a entrega; pelo celular ou teclado, use Editar nos detalhes.</p>}
    {salvando && <p role="status" className="text-sm text-muted-foreground">Salvando nova data de entrega…</p>}
    {modo === "mes" && <p className="text-xs text-muted-foreground md:hidden">Deslize o calendário para ver todos os dias ou escolha Semanal.</p>}
    <div className="overflow-x-auto rounded-2xl border bg-card p-3 shadow-sm" role="region" aria-label="Calendário de entregas" tabIndex={0}>
      <div className={modo === "mes" ? "min-w-[840px]" : "min-w-0"}>
        <div className={"mb-2 grid grid-cols-7 gap-2 text-center text-sm font-semibold text-muted-foreground " + (modo === "semana" ? "hidden lg:grid" : "")}>{DIAS.map(d => <div key={d} className="py-2">{d}</div>)}</div>
        <div className={modo === "mes" ? "grid grid-cols-7 gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-7"}>
          {dias.map(data => {
            const iso = dataISO(data), doDia = porDia.get(iso) ?? [], ehHoje = iso === hoje;
            return <section key={iso} aria-label={data.toLocaleDateString("pt-BR")}
              onPointerDown={() => { bloquearClique.current = false; }}
              onClick={() => criarNoDia(iso)}
              onDragOver={evento => {
                if (!arrastando.current || salvando) return;
                evento.preventDefault(); evento.dataTransfer.dropEffect = "move"; definirDestino(iso);
              }}
              onDragLeave={evento => { if (!(evento.relatedTarget instanceof Node) || !evento.currentTarget.contains(evento.relatedTarget)) definirDestino(null); }}
              onDrop={evento => {
                if (!arrastando.current || salvando) return;
                evento.preventDefault(); evento.stopPropagation();
                const pedido = pedidos.find(p => p.id === arrastando.current);
                arrastando.current = null; definirDestino(null);
                if (pedido && pedido.status === "CONFIRMADO" && !pedido.excluidoEm && pedido.previsaoEntrega?.slice(0, 10) !== iso) onReagendar?.(pedido, iso);
              }}
              className={"group flex min-w-0 flex-col overflow-hidden rounded-xl border-2 p-2 " + (destino === iso ? "border-primary bg-primary/10 ring-2 ring-primary " : ehHoje ? "border-primary bg-primary/5 " : "border-border ") + (onNovoPedido && !salvando ? "cursor-pointer " : "") + (modo === "mes" ? "h-44 " : "h-64 ") + (data.getMonth() !== referencia.getMonth() && modo === "mes" ? "bg-muted/50" : "bg-background/40")}>
              <div className="mb-2 flex h-7 shrink-0 items-center justify-between gap-1">
                <span aria-current={ehHoje ? "date" : undefined} title={ehHoje ? "Hoje" : undefined} className={"whitespace-nowrap text-sm font-semibold " + (ehHoje ? "rounded-lg bg-primary px-2 py-1 text-primary-foreground" : "px-1")}>
                  {modo === "semana" && <span>{DIAS[data.getDay()]} · </span>}{data.getDate()}{ehHoje && <span className="hidden 2xl:inline"> · Hoje</span>}
                </span>
                <div className="flex items-center gap-1">
                  {doDia.length > 0 && <span className="text-xs text-muted-foreground">{doDia.length}</span>}
                  {onNovoPedido && <button type="button" disabled={salvando} aria-label={`Novo pedido em ${data.toLocaleDateString("pt-BR")}`} title="Novo pedido neste dia"
                    onKeyDown={() => { bloquearClique.current = false; }}
                    onClick={evento => { evento.stopPropagation(); criarNoDia(iso); }}
                    className="rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><Plus className="size-3.5" /></button>}
                </div>
              </div>
              <div role="region" aria-label={`Pedidos de ${data.toLocaleDateString("pt-BR")}`} tabIndex={doDia.length ? 0 : undefined} className="rolagem-pedidos min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 focus-visible:outline-2 focus-visible:outline-ring">
                {doDia.map(cartao)}
                {doDia.length === 0 && <p className="px-1 py-4 text-xs text-muted-foreground">Sem entregas</p>}
              </div>
            </section>;
          })}
        </div>
      </div>
    </div>
    {semData.length > 0 && <section className="space-y-3 rounded-2xl border bg-card p-4"><h3 className="font-semibold">Sem previsão de entrega ({semData.length})</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{semData.map(cartao)}</div></section>}
  </div>;
}
