"use client";

import { useState } from "react";
import { Tags } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EtiquetaCadastroCampos({
  habilitadaInicial,
  validadeSecoDias,
  validadeRefrigeradoDias,
  validadeCongeladoDias,
  disabled,
}: {
  habilitadaInicial?: boolean;
  validadeSecoDias?: number | null;
  validadeRefrigeradoDias?: number | null;
  validadeCongeladoDias?: number | null;
  disabled?: boolean;
}) {
  const [habilitada, setHabilitada] = useState(habilitadaInicial ?? false);

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Etiqueta</p>
      <input type="hidden" name="etiquetaHabilitada" value={habilitada ? "on" : ""} />
      <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
        <Checkbox id="etiquetaHabilitada" checked={habilitada} onCheckedChange={(valor) => setHabilitada(valor === true)} disabled={disabled} />
        <div className="space-y-1">
          <Label htmlFor="etiquetaHabilitada" className="flex items-center gap-2"><Tags className="size-4" />Habilitar este item no módulo de etiquetas</Label>
          <p className="text-xs text-muted-foreground">Os prazos abaixo serão usados para calcular a validade ao emitir a etiqueta.</p>
        </div>
      </div>

      <div className={habilitada ? "space-y-3 rounded-lg border p-3" : "hidden"} aria-hidden={!habilitada}>
          <div className="grid gap-3 @md:grid-cols-2">
            <Prazo name="validadeSecoDias" label="Ambiente" valor={validadeSecoDias} disabled={disabled} />
            <Prazo name="validadeRefrigeradoDias" label="Refrigerado" valor={validadeRefrigeradoDias} disabled={disabled} />
            <Prazo name="validadeCongeladoDias" label="Congelado" valor={validadeCongeladoDias} disabled={disabled} />
          </div>
          <p className="text-xs text-muted-foreground">Todas as validades são consideradas após aberto. A embalagem fechada segue a validade informada pelo fornecedor. O prazo é contado em dias de calendário.</p>
      </div>
    </section>
  );
}

function Prazo({ name, label, valor, disabled }: { name: string; label: string; valor?: number | null; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label} <span className="font-normal text-muted-foreground">(após aberto)</span></Label>
      <div className="relative">
        <Input id={name} name={name} inputMode="numeric" restricao="inteiro" min={1} maxLength={4} defaultValue={valor ?? ""} disabled={disabled} placeholder="Não definido" className="pr-14" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">dias</span>
      </div>
    </div>
  );
}
