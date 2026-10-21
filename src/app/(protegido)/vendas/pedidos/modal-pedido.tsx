"use client";
import { createContext, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { ConfirmacaoDescarteDialogo, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { retornoGestorSeguro, rotaPopupPedido } from "./pedidos-navegacao";
import "./painel-pedido.css";

type ContextoPopup = { retorno: string; marcarAlterado: (parte?: string) => void; marcarSalvo: (parte?: string) => void; temAlteracoes: (parte?: string) => boolean; bloquearSaida: (parte: string, bloqueada: boolean) => void; navegar: (caminho: string) => void };
export const PedidoPopupContext = createContext<ContextoPopup | null>(null);
let navegacaoPainel: ((url: string) => void) | null = null;
/** O Gestor delega sua navegação enquanto um painel tem rascunho ou envio pendente. */
export function navegarComPedidoAberto(url: string): boolean {
  if (!navegacaoPainel) return false;
  navegacaoPainel(url); return true;
}
const consultaDesktop = "(min-width: 1280px)";
function assinarDesktop(alterar: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const consulta = window.matchMedia(consultaDesktop);
  consulta.addEventListener("change", alterar);
  return () => consulta.removeEventListener("change", alterar);
}
function desktopAtual() { return typeof window.matchMedia === "function" && window.matchMedia(consultaDesktop).matches; }

export function ModalPedido({ children, titulo, descricao, retorno, protegerAlteracoes = false, detalhe = false }: {
  children: ReactNode; titulo: string; descricao: string; retorno?: string; protegerAlteracoes?: boolean; detalhe?: boolean;
}) {
  const router = useRouter();
  const desktop = useSyncExternalStore(assinarDesktop, desktopAtual, () => false);
  const destino = retornoGestorSeguro(retorno);
  const alteracoes = useRef(new Set<string>());
  const bloqueios = useRef(new Set<string>());
  const proximoDestino = useRef(destino), focoAnterior = useRef<HTMLElement | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [fechamentoPendente, setFechamentoPendente] = useState(false);
  const irPara = useCallback((url: string) => {
    // Consulta separada: evita que o intercept genérico de IDs trate "cancelados" como pedido.
    if (url.split("?")[0] === "/vendas/pedidos/cancelados") window.location.assign(url);
    else router.replace(url, { scroll: false });
  }, [router]);
  function continuarEdicao() { setFechamentoPendente(false); requestAnimationFrame(() => focoAnterior.current?.focus({ preventScroll: true })); }
  const solicitarDestino = useCallback((url: string, cancelar?: () => void) => {
    if (bloqueios.current.size) { cancelar?.(); return; }
    if (!protegerAlteracoes || !alteracoes.current.size) { irPara(url); return; }
    cancelar?.(); proximoDestino.current = url;
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFechamentoPendente(true);
  }, [protegerAlteracoes, irPara]);
  useEffect(() => {
    if (!detalhe) return;
    const navegar = (url: string) => solicitarDestino(url);
    navegacaoPainel = navegar;
    return () => { if (navegacaoPainel === navegar) navegacaoPainel = null; };
  }, [detalhe, solicitarDestino]);
  const marcarAlterado = useCallback((parte = "pedido") => { alteracoes.current.add(parte); }, []);
  const marcarSalvo = useCallback((parte = "pedido") => { alteracoes.current.delete(parte); setFechamentoPendente(false); }, []);
  const temAlteracoes = useCallback((parte = "pedido") => alteracoes.current.has(parte), []);
  const bloquearSaida = useCallback((parte: string, bloqueada: boolean) => { if (bloqueada) bloqueios.current.add(parte); else bloqueios.current.delete(parte); }, []);
  return <Dialog open modal={detalhe ? !desktop : true} disablePointerDismissal={detalhe} protegerAlteracoes={false} onOpenChange={(aberto, detalhes) => {
    if (aberto) return;
    if (fechamentoPendente) { detalhes.cancel(); if (detalhes.reason === "escape-key") continuarEdicao(); return; }
    solicitarDestino(destino, () => detalhes.cancel());
  }}>
    <DialogContent variant={detalhe ? "painel-direito" : "default"} showOverlay={!detalhe || !desktop} aria-modal={detalhe ? !desktop : true} initialFocus={detalhe ? tituloRef : undefined} data-pedido-painel={detalhe ? "detalhe" : undefined} className={detalhe ? "pedido-painel break-words" : "max-h-[calc(100dvh-2rem)] overflow-y-auto break-words sm:max-w-5xl"}>
      <DialogHeader className={detalhe ? "pedido-painel-cabecalho" : undefined}>{detalhe && <span className="pedido-painel-icone"><Package aria-hidden="true" /></span>}<DialogTitle ref={tituloRef} tabIndex={detalhe ? -1 : undefined}>{titulo}</DialogTitle><DialogDescription className={detalhe ? "sr-only" : undefined}>{descricao}</DialogDescription></DialogHeader>
      <ConfirmacaoDescarteDialogo aberto={fechamentoPendente} descricao="As alterações não salvas deste pedido serão perdidas." continuar={continuarEdicao} descartar={() => irPara(proximoDestino.current)} />
      <PedidoPopupContext.Provider value={{ retorno: destino, marcarAlterado, marcarSalvo, temAlteracoes, bloquearSaida, navegar: caminho => solicitarDestino(rotaPopupPedido(caminho, destino)) }}><div className={detalhe ? "pedido-painel-conteudo" : "contents"} inert={fechamentoPendente || undefined}>{children}</div></PedidoPopupContext.Provider>
    </DialogContent>
  </Dialog>;
}
