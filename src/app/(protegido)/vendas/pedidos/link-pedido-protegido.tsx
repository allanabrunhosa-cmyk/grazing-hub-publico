"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { navegarComPedidoAberto } from "./modal-pedido";

/** Atalhos fora do Gestor também respeitam o rascunho aberto no painel. */
export function LinkPedidoProtegido({ onClick, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  return <Link {...props} onClick={e => {
    onClick?.(e);
    if (!e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0 && navegarComPedidoAberto(props.href)) e.preventDefault();
  }} />;
}
