"use client";

import { ClipboardList } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { CAMINHO_PEDIDOS } from "@/lib/hosts";
import { useAcesso } from "./acesso-contexto";
import { NavLink } from "./nav-link";

export function ConteudoMenuPedidos() {
  const { podeRota } = useAcesso();
  return <>
    <div className="flex items-center gap-3 px-5 pt-7 pb-6">
      <LogoMark className="size-10 shrink-0 shadow-sm" label="Grazing Pedidos" monograma="GP" />
      <div><span className="block text-base font-semibold tracking-tight">Grazing Pedidos</span><span className="text-xs text-muted-foreground">by Grazing Table &amp; Co</span></div>
    </div>
    <nav aria-label="Navegação de Pedidos" className="flex-1 space-y-1 px-3 pb-5">
      <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Área de trabalho</p>
      {podeRota(CAMINHO_PEDIDOS) && <NavLink href={CAMINHO_PEDIDOS}><ClipboardList className="size-4" />Gestor de pedidos</NavLink>}
    </nav>
    <div className="mx-5 border-t border-sidebar-border py-5 text-xs text-muted-foreground">Grazing Table &amp; Co · Gestão integrada</div>
  </>;
}

export function MenuPedidos() {
  return <aside className="menu-lateral menu-pedidos"><ConteudoMenuPedidos /></aside>;
}
