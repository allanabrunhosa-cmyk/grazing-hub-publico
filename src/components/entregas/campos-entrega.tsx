"use client";
import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export function CampoEntrega({ nome, children }: { nome: string; children: ReactNode }) { return <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">{nome}</span>{children}</label>; }
export function EscolhaEntrega({ nome, valor, opcoes, alterar, disabled, ocultarRotulo = false }: { nome: string; valor: string; opcoes: { value: string; label: string }[]; alterar: (v: string) => void; disabled?: boolean; ocultarRotulo?: boolean }) {
  const id = useId(); return <div className={ocultarRotulo ? "min-w-0" : "min-w-0 space-y-2"}><Label htmlFor={id} className={ocultarRotulo ? "sr-only" : undefined}>{nome}</Label><Select value={valor} onValueChange={v => alterar(v ?? "")} disabled={disabled}><SelectTrigger id={id} className="w-full"><SelectValue>{opcoes.find(o => o.value === valor)?.label ?? "Selecione"}</SelectValue></SelectTrigger><SelectContent>{opcoes.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>;
}
export function DinheiroOpcionalEntrega({ nome, valor, alterar, custo = false }: { nome: string; valor: string | null; alterar: (v: string | null) => void; custo?: boolean }) { return <CampoEntrega nome={`${nome} (opcional)`}><CurrencyInput value={valor ?? ""} onValueChange={v => alterar(v || null)} placeholder={custo ? "Não informado" : "Desativado"} /><span className="text-xs text-muted-foreground">{custo ? "Deixe vazio quando o custo for desconhecido." : "Deixe vazio para desativar."}</span></CampoEntrega>; }
