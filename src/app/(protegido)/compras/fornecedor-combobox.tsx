"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxContent, ComboboxItem } from "@/components/ui/combobox";
import type { FornecedorOption } from "@/app/(protegido)/compras/types";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";

type Opcao = { value: string; label: string };

export function FornecedorCombobox({
  fornecedores,
  value,
  onChange,
  disabled,
  podeCadastrar = false,
  aoCriar,
  ariaLabel = "Fornecedor",
}: {
  fornecedores: FornecedorOption[];
  value: string | null;
  onChange: (fornecedorId: string | null) => void;
  disabled?: boolean;
  podeCadastrar?: boolean;
  aoCriar?: (fornecedor: FornecedorOption) => void;
  ariaLabel?: string;
}) {
  const [criados, setCriados] = useState<FornecedorOption[]>([]);
  const disponiveis = [...fornecedores, ...criados.filter((criado) => !fornecedores.some((fornecedor) => fornecedor.id === criado.id))];
  const opcoes: Opcao[] = disponiveis.map((f) => ({ value: f.id, label: f.nome }));
  const selecionado = opcoes.find((o) => o.value === value) ?? null;

  return <div className="space-y-1.5">
    <Combobox
      items={opcoes}
      value={selecionado}
      onValueChange={(v) => onChange(v ? (v as Opcao).value : null)}
      disabled={disabled}
    >
      <ComboboxInputGroup>
        <ComboboxInput placeholder="Buscar fornecedor..." aria-label={ariaLabel} />
      </ComboboxInputGroup>
      <ComboboxContent>
        {(item: Opcao) => (
          <ComboboxItem key={item.value} value={item}>
            {item.label}
          </ComboboxItem>
        )}
      </ComboboxContent>
    </Combobox>
    {podeCadastrar && !disabled && <FornecedorDialog
      canaisPedidoOptions={[]}
      formasPagamentoOptions={[]}
      tipoInicial="FORNECEDOR"
      tipoFixo
      aoSalvar={(cadastro) => {
        const criado = { id: cadastro.id, nome: cadastro.nome };
        setCriados((atuais) => [...atuais.filter((item) => item.id !== criado.id), criado]);
        aoCriar?.(criado);
        onChange(criado.id);
      }}
      trigger={<Button type="button" variant="link" size="sm"><Plus className="size-3.5" />Cadastrar novo fornecedor</Button>}
    />}
  </div>;
}
