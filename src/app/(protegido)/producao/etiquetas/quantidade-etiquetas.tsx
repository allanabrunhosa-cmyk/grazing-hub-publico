"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function quantidadeEtiquetasValida(valor: string, minimo: number, maximo: number) {
  return /^\d+$/.test(valor) && Number(valor) >= minimo && Number(valor) <= maximo;
}

export function QuantidadeEtiquetas({ id, valor, maximo, minimo = 1, produto, disabled, onChange }: {
  id: string;
  valor: string;
  maximo: number;
  minimo?: number;
  produto?: string;
  disabled?: boolean;
  onChange: (valor: string) => void;
}) {
  const valido = quantidadeEtiquetasValida(valor, minimo, maximo);
  const sufixo = produto ? ` de ${produto}` : "";
  const ajudaId = `${id}-ajuda`;
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>Quantidade de etiquetas</Label>
    <div className="flex items-center gap-2">
      <Button size="icon" variant="outline" aria-label={`Diminuir cópias${sufixo}`} disabled={disabled || Number(valor) <= minimo} onClick={() => onChange(String(Math.max(minimo, Math.min(maximo, Number(valor) - 1))))}><Minus /></Button>
      <Input id={id} aria-label={`Quantidade de etiquetas${sufixo}`} className="text-center tabular-nums" type="number" inputMode="numeric" restricao="inteiro" min={minimo} max={maximo} step={1} maxLength={String(maximo).length} value={valor} disabled={disabled} aria-invalid={!valido} aria-describedby={ajudaId} onChange={evento => onChange(evento.target.value)} />
      <Button size="icon" variant="outline" aria-label={`Aumentar cópias${sufixo}`} disabled={disabled || Number(valor) >= maximo} onClick={() => onChange(String(Math.min(maximo, Math.max(minimo, Number(valor) + 1))))}><Plus /></Button>
    </div>
    <p id={ajudaId} className={`text-xs ${valido ? "text-muted-foreground" : "text-destructive"}`} aria-live="polite">{valido ? `De ${minimo} a ${maximo} etiquetas.${minimo === 0 ? " Use 0 para não selecionar." : ""}` : `Informe um número inteiro de ${minimo} a ${maximo}.`}</p>
  </div>;
}
