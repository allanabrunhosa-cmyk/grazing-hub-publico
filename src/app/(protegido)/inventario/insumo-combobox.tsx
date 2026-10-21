"use client";

import { useState } from "react";
import { Combobox, ComboboxContent, ComboboxItem } from "@/components/ui/combobox";
import type { InsumoOption } from "@/app/(protegido)/inventario/types";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";
import { CadastroRapidoInsumoDialog } from "@/components/cadastro-rapido-insumo-dialog";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { CampoBuscaInsumo } from "@/components/campo-busca-insumo";

type Opcao = { value: string; label: string; nome: string; especificacao?: string | null };

export function InsumoCombobox({
  insumos,
  value,
  onChange,
  disabled,
  podeCadastrar = false,
  fornecedorIdNovo,
  aoCriar,
  invalido = false,
  ariaLabel = "Insumo",
}: {
  insumos: InsumoOption[];
  value: string | null;
  onChange: (insumoId: string | null) => void;
  disabled?: boolean;
  podeCadastrar?: boolean;
  fornecedorIdNovo?: string | null;
  aoCriar?: (insumo: InsumoCriado) => void;
  invalido?: boolean;
  ariaLabel?: string;
}) {
  const [criados, setCriados] = useState<InsumoCriado[]>([]);
  const disponiveis = [...insumos, ...criados.filter((criado) => !insumos.some((insumo) => insumo.id === criado.id))];
  const opcoes: Opcao[] = disponiveis.map((i) => ({ value: i.id, label: i.nome, nome: i.nome, especificacao: i.especificacao }));
  const selecionado = opcoes.find((o) => o.value === value) ?? null;

  return <div className="space-y-1.5">
    <Combobox
      items={opcoes}
      value={selecionado}
      onValueChange={(v) => onChange(v ? (v as Opcao).value : null)}
      disabled={disabled}
    >
      <CampoBuscaInsumo selecionado={selecionado} invalido={invalido} ariaLabel={ariaLabel} />
      <ComboboxContent>
        {(item: Opcao) => (
          <ComboboxItem key={item.value} value={item}>
            <IdentificacaoInsumo nome={item.nome} nomeClassName="font-medium" />
          </ComboboxItem>
        )}
      </ComboboxContent>
    </Combobox>
    {podeCadastrar && !disabled && <CadastroRapidoInsumoDialog fornecedorId={fornecedorIdNovo} aoSalvar={(insumo) => {
      setCriados((atuais) => [...atuais.filter((item) => item.id !== insumo.id), insumo]);
      aoCriar?.(insumo);
      onChange(insumo.id);
    }} />}
  </div>;
}
