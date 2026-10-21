"use client";

import { useAcesso } from "./acesso-contexto";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Lock } from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_MODULES, findModuleByPathname } from "@/lib/modules";
import { useMenuRecolhido } from "./menu-lateral";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ModuleSwitcher() {
  const pathname = usePathname();
  const { entradaModulo } = useAcesso();
  const currentModule = findModuleByPathname(pathname);
  const Icon = currentModule.icon;
  const recolhido = useMenuRecolhido();
  const gatilho = <DropdownMenuTrigger
    aria-label={`Trocar módulo: ${currentModule.name}`}
    className={`menu-modulo flex w-full items-center gap-2.5 rounded-2xl border border-sidebar-border bg-card/70 text-left text-sidebar-foreground shadow-xs transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${recolhido ? "justify-center p-2" : "p-3"}`}
    render={<button type="button" />}>
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: currentModule.color }}><Icon className="size-4" /></span>
    {!recolhido && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{currentModule.name}</span><span className="block truncate text-xs text-muted-foreground">{currentModule.subtitle}</span></span><ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/55" /></>}
  </DropdownMenuTrigger>;

  return (
    <DropdownMenu>
      {/* Gatilho compartilhado mantém o menu em portal; tooltip não é recortado. */}
      {recolhido ? <Tooltip><TooltipTrigger render={gatilho} /><TooltipContent>{currentModule.name}</TooltipContent></Tooltip> : gatilho}


      <DropdownMenuContent className="w-72" align="start">
        {APP_MODULES.filter(module => entradaModulo(module.slug)).map((module) => {
          const ModuleIcon = module.icon;
          const isCurrent = module.slug === currentModule.slug;

          return (
            <DropdownMenuItem
              key={module.slug}
              className={cn("gap-2.5 py-1.5", isCurrent && "bg-accent")}
              render={<Link href={entradaModulo(module.slug) ?? module.href} />}
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: module.color }}
              >
                <ModuleIcon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{module.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{module.subtitle}</span>
              </span>
              {!module.active && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  Em breve
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
