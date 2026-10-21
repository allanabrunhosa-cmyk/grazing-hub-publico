"use client";

import { useAcesso } from "./acesso-contexto";
import { ChevronDown, User, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutMenuItem } from "@/components/layout/logout-menu-item";
import Link from "next/link";

import { usePathname } from "next/navigation";
import { findModuleByPathname } from "@/lib/modules";
import { NavegacaoMovel } from "./navegacao-movel";
import { SeletorAparencia } from "./seletor-aparencia";
import { CAMINHO_PEDIDOS, type IdentidadeInterface } from "@/lib/hosts";
import { LogoMark } from "@/components/logo";
import { LinkPedidoProtegido } from "@/app/(protegido)/vendas/pedidos/link-pedido-protegido";

export function CabecalhoConteudo({ sessao, dedicado = false, identidade = dedicado ? "etiquetas" : "hub" }: {
  dedicado?: boolean;
  identidade?: IdentidadeInterface;
  sessao: { nome?: string | null; email?: string | null; admin?: boolean; perfilNome?: string } | null;
}) {
  const { entradaModulo, podeRota } = useAcesso();
  const interfaceDedicada = identidade !== "hub";
  const pathname = usePathname();
  const modulo = findModuleByPathname(pathname);
  const iniciais = (sessao?.nome ?? sessao?.email ?? "?")
    .split(" ")
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const cabecalho = (
    <header className="cabecalho-sistema">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {identidade !== "pedidos" && <NavegacaoMovel identidade={identidade} />}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{identidade === "pedidos" ? "Gestor de Pedidos" : identidade === "etiquetas" ? "Grazing HUB · Validades" : modulo.name}</p>
          {identidade !== "pedidos" && <p className="hidden text-xs text-muted-foreground sm:block">{sessao?.perfilNome ?? (sessao?.admin ? "Administrador" : "Membro da equipe")}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
      <SeletorAparencia />
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Abrir menu da conta" className="flex min-h-11 items-center gap-2 rounded-full border border-border/70 bg-card/60 py-1 pr-3 pl-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {iniciais}
          </div>
          <span className="hidden max-w-48 truncate text-sm font-medium xl:inline">{sessao?.nome}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-1.5 py-1">
            <p className="break-words text-sm font-medium text-foreground">{sessao?.nome}</p>
            <p className="break-words text-xs text-muted-foreground">{sessao?.email}</p>
          </div>
          <DropdownMenuSeparator />
          {!interfaceDedicada && <DropdownMenuItem className="gap-2" render={<Link href="/perfil" />}>
            <User className="size-4" />
            Meu Perfil
          </DropdownMenuItem>}
          {!interfaceDedicada && entradaModulo("configuracoes") && (
            <DropdownMenuItem className="gap-2" render={<Link href={entradaModulo("configuracoes")!} />}>
              <Settings className="size-4" />
              Configurações
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <LogoutMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );

  if (identidade !== "pedidos") return cabecalho;

  const marca = <>
    <LogoMark className="size-10 shrink-0 shadow-sm" label="Grazing Pedidos" monograma="GP" />
    <div className="min-w-0">
      <span className="block text-sm leading-4 font-semibold tracking-tight">Grazing Pedidos</span>
      <span className="block text-xs text-muted-foreground">by Grazing Table &amp; Co</span>
    </div>
  </>;

  return <div className="cabecalho-pedidos">
    {podeRota(CAMINHO_PEDIDOS)
      ? <LinkPedidoProtegido href={CAMINHO_PEDIDOS} aria-label="Ir para o Gestor de Pedidos" aria-current={pathname === CAMINHO_PEDIDOS ? "page" : undefined} className="marca-pedidos outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{marca}</LinkPedidoProtegido>
      : <div className="marca-pedidos">{marca}</div>}
    {cabecalho}
  </div>;
}
