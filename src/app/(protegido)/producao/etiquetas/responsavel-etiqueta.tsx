"use client";

import { useState } from "react";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ResponsavelEtiquetaOpcao = { id: string; nome: string; origem?: "USUARIO" | "CADASTRO" };

export function ResponsavelEtiqueta({ opcoes, usuarioId, nome, onChange }: {
  opcoes: ResponsavelEtiquetaOpcao[];
  usuarioId: string;
  nome: string;
  onChange: (usuarioId: string, nome: string) => void;
}) {
  const [manual, setManual] = useState(false);
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return <div className="space-y-2">
    <Label htmlFor="responsavel-etiqueta">Responsável pela manipulação</Label>
    {manual ? <Input id="responsavel-etiqueta" value={nome} onChange={evento => onChange("", evento.target.value)} maxLength={120} autoComplete="off" placeholder="Nome de quem manipulou" /> :
      <Combobox items={opcoes} value={opcoes.find(opcao => opcao.id === usuarioId) ?? null}
        itemToStringLabel={opcao => opcao.nome} isItemEqualToValue={(a, b) => a.id === b.id}
        filter={(opcao, consulta) => normalizar(opcao.nome).includes(normalizar(consulta.trim()))}
        onValueChange={opcao => onChange(opcao?.id ?? "", opcao?.nome ?? "")}>
        <ComboboxInputGroup><ComboboxInput id="responsavel-etiqueta" placeholder="Buscar pessoa cadastrada no HUB" /></ComboboxInputGroup>
        <ComboboxContent emptyLabel="Nenhuma pessoa encontrada. Use Informar outro nome.">
          {(opcao: ResponsavelEtiquetaOpcao) => <ComboboxItem key={opcao.id} value={opcao} className="min-h-11">{opcao.nome}</ComboboxItem>}
        </ComboboxContent>
      </Combobox>}
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={manual} onChange={evento => { setManual(evento.target.checked); onChange("", ""); }} /> Informar outro nome (pessoa sem conta)</label>
    <p className="text-xs text-muted-foreground">A lista usa os usuários ativos do HUB. O responsável pela manipulação e quem emitiu ficam registrados separadamente.</p>
  </div>;
}
