"use client";

import { createContext, useCallback, useContext, useId, useSyncExternalStore, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "cn";
import { LogoMark } from "@/components/logo";

const ContextoMenu = createContext(false);
const ContextoControleMenu = createContext<{ id: string; alternar: () => void } | null>(null);
const eventoPreferencia = "grazing:menu-lateral";
const preferenciaSemArmazenamento = new Map<string, boolean>();
export function useMenuRecolhido() { return useContext(ContextoMenu); }

/** Preferência visual local por usuário; não modifica sessão ou permissões. */
export function MenuLateral({ children, className, usuarioId = "local" }: { children: ReactNode; className?: string; usuarioId?: string }) {
  const chave = `grazing:menu-lateral:${usuarioId}`;
  const ler = useCallback(() => { if (preferenciaSemArmazenamento.has(chave)) return preferenciaSemArmazenamento.get(chave)!; try { return localStorage.getItem(chave) === "recolhido"; } catch { return false; } }, [chave]);
  const assinar = useCallback((atualizar: () => void) => {
    const receber = (evento: Event) => { if (evento instanceof StorageEvent && (evento.key === chave || evento.key === null)) preferenciaSemArmazenamento.delete(chave); atualizar(); };
    window.addEventListener("storage", receber); window.addEventListener(eventoPreferencia, receber);
    return () => { window.removeEventListener("storage", receber); window.removeEventListener(eventoPreferencia, receber); };
  }, [chave]);
  const recolhido = useSyncExternalStore(assinar, ler, () => false);
  const id = useId();
  function alternar() {
    try { localStorage.setItem(chave, recolhido ? "expandido" : "recolhido"); preferenciaSemArmazenamento.delete(chave); } catch { preferenciaSemArmazenamento.set(chave, !recolhido); }
    window.dispatchEvent(new Event(eventoPreferencia));
  }
  return <ContextoMenu.Provider value={recolhido}>
    <ContextoControleMenu.Provider value={{ id, alternar }}>
    <aside className={cn("menu-lateral", className)} data-recolhido={recolhido || undefined}>
      <div id={id} className="menu-lateral-conteudo">{children}</div>
    </aside>
    </ContextoControleMenu.Provider>
  </ContextoMenu.Provider>;
}

/** Cabeçalho reservado à marca, independente do controle de recolhimento. */
export function CabecalhoMenuLateral({ nome = "Grazing HUB", monograma = "GH" }: { nome?: string; monograma?: string }) {
  return <div className="menu-cabecalho">
    <div className="menu-marca">
      <LogoMark className="menu-logo shrink-0 shadow-sm" label={nome} monograma={monograma} />
      <div className="min-w-0">
        <span className="block truncate text-base font-semibold tracking-tight">{nome}</span>
        <span className="block truncate text-xs text-muted-foreground">by Grazing Table &amp; Co</span>
      </div>
    </div>
  </div>;
}

/** Controle único no rodapé; a navegação móvel conserva seu próprio fechamento. */
export function RodapeMenuLateral() {
  const controle = useContext(ContextoControleMenu);
  const recolhido = useMenuRecolhido();
  const rotulo = recolhido ? "Expandir menu lateral" : "Recolher menu lateral";
  return <footer className="menu-rodape mx-5 border-t border-sidebar-border text-xs text-muted-foreground">
    <span className="menu-rodape-texto">Grazing Table &amp; Co · Gestão integrada</span>
    {controle && <div className="menu-lateral-controle"><Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={rotulo} aria-expanded={!recolhido} aria-controls={controle.id} onClick={controle.alternar} />}>
      {recolhido ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
    </TooltipTrigger><TooltipContent>{rotulo}</TooltipContent></Tooltip></div>}
  </footer>;
}
