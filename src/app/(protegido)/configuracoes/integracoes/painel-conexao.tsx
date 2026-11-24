"use client";
import { useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Peças comuns dos painéis Asaas e Site: mesma grade de situação e mesmo campo de endereço. */
export const quando = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "Ainda não ocorreu";

export function Situacao({ itens }: { itens: { nome: string; valor: ReactNode }[] }) {
  return <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{itens.map(i => <div key={i.nome} className="min-w-0"><dt className="text-xs text-muted-foreground">{i.nome}</dt><dd className="break-words text-sm">{i.valor}</dd></div>)}</dl>;
}
export function Presenca({ ok, sim, nao }: { ok: boolean; sim: string; nao: string }) {
  return <Badge variant={ok ? "success" : "muted"}>{ok ? sim : nao}</Badge>;
}
export function EnderecoWebhook({ id, endereco, descricao }: { id: string; endereco: string; descricao: string }) {
  const [copiado, setCopiado] = useState(false);
  return <div className="space-y-1">
    <Label htmlFor={id}>Endereço do webhook</Label>
    <div className="flex min-w-0 items-center gap-2"><Input id={id} readOnly value={endereco} className="min-w-0 flex-1" onFocus={e => e.currentTarget.select()} />
      <Button type="button" variant="outline" onClick={() => { void navigator.clipboard?.writeText(endereco).then(() => setCopiado(true), () => setCopiado(false)); }}><Copy aria-hidden className="size-4" />{copiado ? "Copiado" : "Copiar"}</Button></div>
    <p className="text-xs text-muted-foreground">{descricao}</p>
  </div>;
}
export function Pendencias({ itens }: { itens: string[] }) {
  if (!itens.length) return null;
  return <div className="space-y-1"><p className="text-sm font-medium">O que falta para funcionar</p><ul className="list-disc space-y-1 pl-5 text-sm">{itens.map(p => <li key={p}>{p}</li>)}</ul></div>;
}
