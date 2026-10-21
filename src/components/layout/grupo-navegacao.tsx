"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { NavLink } from "./nav-link";
import Link from "next/link";
import { useMenuRecolhido } from "./menu-lateral";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Item = { href: string; label: string; icon?: LucideIcon; exact?: boolean };

/** Agrupamento sem página própria; reutiliza a navegação expansível da lateral. */
export function GrupoNavegacao({ titulo, icon: Icon, itens, pathname, podeRota, href }: {
  titulo: string; icon: LucideIcon; itens: Item[]; pathname: string; podeRota: (rota: string) => boolean; href?: string;
}) {
  const filhos = itens.filter(item => podeRota(item.href));
  const ativo = pathname === href || filhos.some(item => pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/")));
  const [abertaFora, setAbertaFora] = useState(false);
  const [recolhidaDentro, setRecolhidaDentro] = useState(false);
  const aberta = ativo ? !recolhidaDentro : abertaFora;
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const recolhido = useMenuRecolhido();
  const [flutuante, setFlutuante] = useState(false);
  if (!filhos.length) return null;

  function recolher() { if (ativo) setRecolhidaDentro(true); else setAbertaFora(false); }

  const links = filhos.map(filho => <NavLink key={filho.href} href={filho.href} exact={filho.exact} className="px-3 py-1.5 text-xs">{filho.icon && <filho.icon aria-hidden="true" className="size-3.5" />}{filho.label}</NavLink>);
  if (recolhido) return <Popover open={flutuante} onOpenChange={setFlutuante}>
    <Tooltip><TooltipTrigger render={<PopoverTrigger aria-label={`Abrir ${titulo}`} aria-current={ativo ? "true" : undefined} className={`menu-grupo-icone ${ativo ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}`} />}><Icon aria-hidden="true" className="size-4" /></TooltipTrigger><TooltipContent>{titulo}</TooltipContent></Tooltip>
    <PopoverContent side="right" align="start" className="menu-grupo-flutuante" onClick={evento => { if (evento.target instanceof Element && evento.target.closest("a[href]")) setFlutuante(false); }}>
      <PopoverTitle className="mb-2">{titulo}</PopoverTitle>
      {href && <Link href={href} className="mb-2 block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">Abrir {titulo}</Link>}
      {/* O portal mantém a navegação completa, independente da largura da lateral. */}
      <LinksGrupo itens={filhos} pathname={pathname} />
    </PopoverContent>
  </Popover>;

  return <div className="pt-1" onKeyDown={evento => {
    if (evento.key === "Escape" && aberta) {
      evento.preventDefault(); evento.stopPropagation(); recolher(); botao.current?.focus();
    }
  }}>
    <div className="flex items-center">
    {href && <Link href={href} aria-current={pathname === href ? "page" : undefined} className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${ativo ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}`}><Icon aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{titulo}</span></Link>}
    <button ref={botao} type="button" aria-label={`${aberta ? "Recolher" : "Expandir"} ${titulo}`} aria-expanded={aberta} aria-controls={id}
      className={`flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring ${href ? "shrink-0" : "w-full"} ${ativo ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}`}
      onClick={() => ativo ? setRecolhidaDentro(valor => !valor) : setAbertaFora(valor => !valor)}>
      {!href && <><Icon aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{titulo}</span></>}
      <ChevronDown aria-hidden="true" className={`ml-auto size-4 shrink-0 transition-transform ${aberta ? "rotate-180" : ""}`} />
    </button>
    </div>
    <div id={id} hidden={!aberta} className="mt-1 ml-5 space-y-1 border-l border-sidebar-border pl-2">
      {links}
    </div>
  </div>;
}

/** Rótulos completos no portal, mesmo sob o contexto da lateral recolhida. */
function LinksGrupo({ itens, pathname }: { itens: Item[]; pathname: string }) {
  return itens.map(item => {
    const ativo = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
    return <Link key={item.href} href={item.href} className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm ${ativo ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`} aria-current={ativo ? "page" : undefined}>{item.icon && <item.icon className="size-4 shrink-0" aria-hidden="true" />}<span>{item.label}</span></Link>;
  });
}
