"use client";
import { BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Campo } from "../componentes";
export function PrecoItemPedido({ indice, base, manual, editar, alterar }: { indice: number; base: string | null; manual: string | null; editar: boolean; alterar: (preco: string | null) => void }) {
  return <Campo nome={`Preço ${indice}`}><div className="flex items-start gap-1"><div className="min-w-0 flex-1"><CurrencyInput aria-label={`Preço ${indice}`} containerClassName="w-full min-w-0" readOnly={!editar || manual === null} value={manual ?? base ?? ""} onValueChange={v => alterar(v || "0")} className={manual !== null ? "border-success/35 bg-success-bg/40" : ""} />{manual !== null && base !== null && <span className="block text-right text-xs text-muted-foreground line-through" aria-label={`Preço original ${indice}`}>{Number(base).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}</div><Button type="button" variant="ghost" size="icon-sm" aria-label={`Desconto do produto ${indice}`} aria-pressed={manual !== null} title="Aplicar desconto" disabled={!editar || !base || !(Number(base) > 0)} className={manual !== null ? "mt-1.5 bg-success-bg text-success" : "mt-1.5 text-muted-foreground"} onClick={() => alterar(manual === null ? base : null)}><BadgeDollarSign className="size-4" /></Button></div></Campo>;
}
