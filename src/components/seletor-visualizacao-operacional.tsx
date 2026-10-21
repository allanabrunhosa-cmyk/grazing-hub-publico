"use client";

import { CalendarDays, Columns3, List } from "lucide-react";
import { cn } from "cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type VisualizacaoOperacional = "quadros" | "calendario" | "lista";

const VISUALIZACOES = [
  { id: "quadros", nome: "Quadros", Icone: Columns3 },
  { id: "calendario", nome: "Calendário", Icone: CalendarDays },
  { id: "lista", nome: "Lista", Icone: List },
] as const;

/** A cor identifica o modo; não modifica a disposição nem os estados dos pedidos. */
export function SeletorVisualizacaoOperacional({ valor, aoMudar, className, disabled = false }: {
  valor: VisualizacaoOperacional;
  aoMudar: (valor: VisualizacaoOperacional) => void;
  className?: string;
  disabled?: boolean;
}) {
  const { Icone } = VISUALIZACOES.find(item => item.id === valor)!;
  return <Select value={valor} onValueChange={novo => { if (VISUALIZACOES.some(item => item.id === novo)) aoMudar(novo as VisualizacaoOperacional); }} items={Object.fromEntries(VISUALIZACOES.map(item => [item.id, item.nome]))} disabled={disabled}>
    <SelectTrigger size="sm" aria-label="Modo de visualização" data-modo={valor} className={cn("ds-seletor-visualizacao", className)}><Icone /><SelectValue /></SelectTrigger>
    <SelectContent alignItemWithTrigger={false}>{VISUALIZACOES.map(({ id, nome, Icone: IconeItem }) => <SelectItem key={id} value={id}><IconeItem className="size-4" />{nome}</SelectItem>)}</SelectContent>
  </Select>;
}
