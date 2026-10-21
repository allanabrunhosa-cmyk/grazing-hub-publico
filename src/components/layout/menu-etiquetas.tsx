"use client";

import { useSearchParams } from "next/navigation";
import { CalendarClock, Printer, Settings2 } from "lucide-react";
import { secaoEtiquetas } from "@/lib/etiquetas/navegacao";
import { CAMINHO_ETIQUETAS } from "@/lib/hosts";
import { useAcesso } from "./acesso-contexto";
import { NavLink } from "./nav-link";
import { CabecalhoMenuLateral, MenuLateral, RodapeMenuLateral } from "./menu-lateral";

export function ConteudoMenuEtiquetas() {
  const secao = secaoEtiquetas(useSearchParams().get("secao"));
  const { admin, pode } = useAcesso();
  const itens = [
    { id: "etiquetas", nome: "Imprimir etiquetas", icone: Printer },
    { id: "validades", nome: "Gestão de validades", icone: CalendarClock },
    ...(admin ? [{ id: "configuracoes", nome: "Configurações", icone: Settings2 }] : []),
  ];
  return <>
    <CabecalhoMenuLateral nome="Grazing Validades" monograma="GV" />
    <nav aria-label="Navegação de Validades" className="flex-1 space-y-1 px-3 pb-5">
      <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Produção e cozinha</p>
      {pode("producao") && itens.map((item) => <NavLink key={item.id} href={item.id === "etiquetas" ? CAMINHO_ETIQUETAS : `${CAMINHO_ETIQUETAS}?secao=${item.id}`}
        ativo={secao === item.id}>
        <item.icone className="size-4" />{item.nome}
      </NavLink>)}
    </nav>
    <RodapeMenuLateral />
  </>;
}

export function MenuEtiquetas({ usuarioId }: { usuarioId?: string }) {
  return <MenuLateral className="menu-etiquetas" usuarioId={usuarioId}><ConteudoMenuEtiquetas /></MenuLateral>;
}
