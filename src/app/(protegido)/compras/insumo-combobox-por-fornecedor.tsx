"use client";

import { useMemo, useState } from "react";
import { Combobox, ComboboxContent, ComboboxItem } from "@/components/ui/combobox";
import type { InsumoComFornecedorOption } from "@/app/(protegido)/compras/types";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";
import { CadastroRapidoInsumoDialog } from "@/components/cadastro-rapido-insumo-dialog";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { CampoBuscaInsumo } from "@/components/campo-busca-insumo";

type Opcao = { value: string; label: string; nome: string; especificacao?: string | null };

export function InsumoComboboxPorFornecedor({
  insumos,
  fornecedorId,
  fornecedorAvulso = false,
  value,
  onChange,
  disabled,
  podeCadastrar = false,
  aoCriar,
}: {
  insumos: InsumoComFornecedorOption[];
  fornecedorId: string | null;
  fornecedorAvulso?: boolean;
  value: string | null;
  onChange: (insumoId: string | null) => void;
  disabled?: boolean;
  podeCadastrar?: boolean;
  aoCriar?: (insumo: InsumoCriado) => void;
}) {
  const [criados, setCriados] = useState<InsumoCriado[]>([]);
  const disponiveis = useMemo(
    () => [...insumos, ...criados.filter((criado) => !insumos.some((insumo) => insumo.id === criado.id))],
    [insumos, criados]
  );
  const opcoes: Opcao[] = useMemo(
    () => disponiveis.filter((i) => fornecedorAvulso || i.fornecedorIds.includes(fornecedorId ?? "")).map((i) => ({ value: i.id, label: i.nome, nome: i.nome, especificacao: i.especificacao })),
    [disponiveis, fornecedorId, fornecedorAvulso]
  );
  const selecionado = opcoes.find((o) => o.value === value) ?? null;

  if (!fornecedorId && !fornecedorAvulso) {
    return <p className="text-sm text-muted-foreground">Selecione um fornecedor primeiro.</p>;
  }

  if (opcoes.length === 0) {
    return <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">
        {fornecedorAvulso ? "Nenhum insumo disponível. Cadastre o item em Insumos." : "Nenhum insumo tem esse fornecedor como homologado. Ajuste o cadastro do insumo em Insumos."}
      </p>
      {podeCadastrar && !disabled && <CadastroRapidoInsumoDialog fornecedorId={fornecedorAvulso ? null : fornecedorId} aoSalvar={(insumo) => {
        setCriados((atuais) => [...atuais.filter((item) => item.id !== insumo.id), insumo]);
        aoCriar?.(insumo);
        onChange(insumo.id);
      }} />}
    </div>;
  }

  return <div className="space-y-1.5">
    <Combobox
      items={opcoes}
      value={selecionado}
      onValueChange={(v) => onChange(v ? (v as Opcao).value : null)}
      disabled={disabled}
    >
      <CampoBuscaInsumo selecionado={selecionado} />
      <ComboboxContent>
        {(item: Opcao) => (
          <ComboboxItem key={item.value} value={item}>
            <IdentificacaoInsumo nome={item.nome} nomeClassName="font-medium" />
          </ComboboxItem>
        )}
      </ComboboxContent>
    </Combobox>
    {podeCadastrar && !disabled && <CadastroRapidoInsumoDialog fornecedorId={fornecedorAvulso ? null : fornecedorId} aoSalvar={(insumo) => {
      setCriados((atuais) => [...atuais.filter((item) => item.id !== insumo.id), insumo]);
      aoCriar?.(insumo);
      onChange(insumo.id);
    }} />}
  </div>;
}
