"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

type OpcaoContada<Valor extends string> = {
  valor: Valor;
  nome: string;
  quantidade: number;
  icone?: ReactNode;
};

/** Cada quantidade considera a busca e os outros filtros, antes da paginação. */
export function FiltroOpcoesContadas<Valor extends string>({ nome, valor, opcoes, onValueChange, className, disabled = false }: {
  nome: string;
  valor: Valor;
  opcoes: readonly OpcaoContada<Valor>[];
  onValueChange: (valor: Valor) => void;
  className?: string;
  disabled?: boolean;
}) {
  return <div role="group" aria-label={nome} className={cn("flex flex-wrap gap-1.5", className)}>
    {opcoes.map(opcao => <Button key={opcao.valor} type="button" size="sm"
      variant={valor === opcao.valor ? "default" : "outline"}
      disabled={disabled} aria-label={`${opcao.nome} (${opcao.quantidade.toLocaleString("pt-BR")})`} aria-pressed={valor === opcao.valor} onClick={() => onValueChange(opcao.valor)}>
      {opcao.icone && <span aria-hidden="true">{opcao.icone}</span>}
      {opcao.nome} <span className="tabular-nums"><span className="sr-only">(</span>{opcao.quantidade.toLocaleString("pt-BR")}<span className="sr-only">)</span></span>
    </Button>)}
  </div>;
}
