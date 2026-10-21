"use client";
import { createContext, useContext, type ReactNode } from "react";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";

const PopupInterceptado = createContext(false);

/** Lê o slot no próprio layout; páginas descendentes já estão em outro contexto do roteador. */
export function ShellPopupsPedidos({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const segmento = useSelectedLayoutSegment("modal");
  const lista = usePathname() === "/vendas/pedidos";
  // default e a página de retorno são nulos; os demais segmentos são intercepts.
  const interceptado = segmento !== null;
  // O Next preserva slots em navegação suave; retorno à lista não exibe popup retido.
  return <PopupInterceptado.Provider value={interceptado || lista}>{children}{!lista && modal}</PopupInterceptado.Provider>;
}

export function PopupDiretoPedido({ children }: { children: ReactNode }) {
  return useContext(PopupInterceptado) ? null : children;
}
