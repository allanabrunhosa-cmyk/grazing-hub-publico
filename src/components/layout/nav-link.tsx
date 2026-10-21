"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Children, isValidElement } from "react";
import { useMenuRecolhido } from "./menu-lateral";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function textoDoLink(children: ReactNode): string {
  return Children.toArray(children).map(child => typeof child === "string" || typeof child === "number" ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? textoDoLink(child.props.children) : "").join("").trim();
}

export function NavLink({ href, exact, ativo, external, children, className, novaAbaAcessivel }: { href: string; exact?: boolean; ativo?: boolean; external?: boolean; children: ReactNode; className?: string; novaAbaAcessivel?: boolean }) {
  const pathname = usePathname();
  const recolhido = useMenuRecolhido();
  const isActive = ativo ?? (exact ? pathname === href : pathname.startsWith(href));
  const link = (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? (novaAbaAcessivel ? "noopener noreferrer" : "noreferrer") : undefined}
      aria-current={isActive ? "page" : undefined}
      data-menu-link=""
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:shrink-0",
        isActive &&
          "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
        className
      )}
    >
      {recolhido ? <>{Children.toArray(children).filter(child => isValidElement(child) && typeof child.type !== "string").slice(0, 1)}<span className="sr-only">{textoDoLink(children)}</span></> : children}
      {external && novaAbaAcessivel && <span className="sr-only"> (abre em nova aba)</span>}
    </Link>
  );
  return recolhido ? <Tooltip><TooltipTrigger render={link} /><TooltipContent>{textoDoLink(children)}</TooltipContent></Tooltip> : link;
}
