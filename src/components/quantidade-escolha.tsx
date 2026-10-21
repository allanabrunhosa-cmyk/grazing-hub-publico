"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** O consumidor informa o teto disponível da opção, incluindo o saldo do grupo. */
export function QuantidadeEscolha({ nome, valor, maximo, alterar, disabled = false }: {
  nome: string; valor: number; maximo: number; alterar: (valor: number) => void; disabled?: boolean;
}) {
  function atualizar(novo: number) {
    if (!disabled && Number.isSafeInteger(novo)) alterar(Math.max(0, Math.min(maximo, novo)));
  }
  return <div role="group" aria-label={`Controle de ${nome}`} className="flex shrink-0 items-center gap-1">
    <Button type="button" variant="outline" size="icon" aria-label={`Diminuir ${nome}`} disabled={disabled || valor <= 0} onClick={() => alterar(Math.max(0, valor - 1))}><Minus /></Button>
    <Input aria-label={nome} className="w-14 px-2 text-center tabular-nums" type="number" min={0} max={maximo} step={1} maxLength={4} value={valor} disabled={disabled} onChange={e => atualizar(Number(e.target.value))} />
    <Button type="button" variant="outline" size="icon" aria-label={`Aumentar ${nome}`} disabled={disabled || valor >= maximo} className="disabled:bg-muted disabled:text-muted-foreground" onClick={() => atualizar(valor + 1)}><Plus /></Button>
  </div>;
}
