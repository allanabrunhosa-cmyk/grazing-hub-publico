"use client";

import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { apresentacaoCanalVenda, type CanalConhecido } from "@/lib/vendas/canais-apresentacao";

const CORES: Record<CanalConhecido, string> = {
  site: "bg-[var(--ds-processo-rota-fundo)] text-[var(--ds-processo-rota)]",
  ifood: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  gf: "bg-[var(--ds-processo-entregue-fundo)] text-[var(--ds-processo-entregue)]",
};

export type TagCanalVendaProps = Omit<ComponentProps<typeof Badge>, "children" | "variant"> & { canal: string | null | undefined };

/** Origem comercial em texto; a paleta não implica estado ou ação do pedido. */
export function TagCanalVenda({ canal, className, ...props }: TagCanalVendaProps) {
  const { nomeOriginal, conhecido, nome } = apresentacaoCanalVenda(canal);
  return <Badge variant="muted" data-canal={conhecido ?? "outro"} title={nomeOriginal} className={cn("max-w-28", conhecido && CORES[conhecido], className)} {...props}><span className="min-w-0 truncate">{nome}</span></Badge>;
}
