"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { diaEntradaEstoque, validarDataEntradaEstoque } from "@/lib/notas-fiscais/data-entrada";
import type { LocalOption } from "./types";

export function EntradaEstoqueNota({ locais, localId, onLocalChange, dataEntrada, onDataChange, bloqueado, mostrarErros, mostrarLocal = true }: {
  locais: LocalOption[];
  localId: string;
  onLocalChange: (valor: string) => void;
  dataEntrada: string;
  onDataChange: (valor: string) => void;
  bloqueado?: boolean;
  mostrarErros?: boolean;
  mostrarLocal?: boolean;
}) {
  const id = useId();
  const validacao = validarDataEntradaEstoque(dataEntrada);
  const dataInvalida = "erro" in validacao;
  const erro = dataEntrada && dataInvalida ? validacao.erro : null;
  const localInvalido = mostrarLocal && !!mostrarErros && !localId;
  const destacarData = !!mostrarErros && dataInvalida;
  const rotuloData = mostrarLocal ? "Data de entrada no estoque" : "Data de recebimento dos produtos";
  const mensagemErro = erro && !mostrarLocal ? erro.replace("entrada no estoque", "recebimento dos produtos").replace("entrada", "recebimento") : erro;
  return <section aria-label={mostrarLocal ? "Entrada no estoque" : "Recebimento dos produtos"} className="space-y-2 rounded-lg border bg-muted/20 p-3">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {mostrarLocal && <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
        <Label htmlFor={`${id}-local`} className="shrink-0 text-xs">Local de estoque</Label>
        <Select value={localId} onValueChange={valor => onLocalChange(valor ?? "")} disabled={bloqueado}>
          <SelectTrigger id={`${id}-local`} aria-invalid={localInvalido} className="min-w-0 flex-1 aria-invalid:bg-destructive/10">
            <SelectValue placeholder="Selecione">{() => locais.find(local => local.id === localId)?.nome ?? "Selecione"}</SelectValue>
          </SelectTrigger>
          <SelectContent>{locais.map(local => <SelectItem key={local.id} value={local.id}>{local.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
      <div className="flex min-w-0 flex-1 basis-80 flex-wrap items-center gap-2">
        <Label htmlFor={`${id}-data`} className="shrink-0 text-xs">{rotuloData}</Label>
        <Input id={`${id}-data`} type="date" value={dataEntrada} max={diaEntradaEstoque()} required
          onChange={evento => onDataChange(evento.target.value)} disabled={bloqueado}
          aria-invalid={destacarData} aria-describedby={`${id}-ajuda`} className="min-w-36 flex-1 aria-invalid:bg-destructive/10" />
      </div>
    </div>
    <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">Informe quando os produtos foram recebidos. {mostrarLocal ? "Esta data será usada no histórico do estoque." : "Uso e consumo não gera entrada em estoque."} Emissão e vencimentos permanecem separados.</p>
    {mostrarErros && !dataEntrada && <p role="alert" className="text-xs font-medium text-destructive">Informe a {mostrarLocal ? "data de entrada no estoque" : "data de recebimento dos produtos"}.</p>}
    {mensagemErro && <p role="alert" className="text-xs font-medium text-destructive">{mensagemErro}</p>}
    {mostrarLocal && locais.length === 0 && <p className="text-xs text-destructive">Cadastre um local de estoque em Inventário antes de conciliar.</p>}
  </section>;
}
