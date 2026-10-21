"use client";

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
} from "@/components/ui/combobox";
import { grupoDreLabels, ORDEM_GRUPOS_DRE } from "@/lib/labels";
import { estilosNaturezaFinanceira, naturezaFinanceiraDoGrupo } from "@/lib/financeiro/natureza-financeira";
import type { CategoriaOption } from "@/app/(protegido)/financeiro/types";
import type { GrupoDre } from "@/generated/prisma/client";

type OpcaoCategoria = CategoriaOption & { value: string; label: string };
type GrupoCategoria = { value: GrupoDre; items: OpcaoCategoria[] };

function normalizar(valor: string) {
  return valor.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function CategoriaFinanceiraCombobox({
  categorias,
  value,
  onChange,
  disabled,
  invalid,
  ariaLabel = "Categoria financeira",
  placeholder = "Buscar categoria...",
}: {
  categorias: CategoriaOption[];
  value: string;
  onChange: (categoriaId: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const grupos: GrupoCategoria[] = ORDEM_GRUPOS_DRE.map((grupo) => ({
    value: grupo,
    items: categorias
      .filter((categoria) => categoria.grupo === grupo)
      .map((categoria) => ({ ...categoria, value: categoria.id, label: categoria.nome })),
  })).filter((grupo) => grupo.items.length > 0);
  const opcoes = grupos.flatMap((grupo) => grupo.items);
  const selecionada = opcoes.find((opcao) => opcao.id === value) ?? null;

  return (
    <Combobox
      items={grupos}
      value={selecionada}
      onValueChange={(opcao) => onChange((opcao as OpcaoCategoria | null)?.id ?? "")}
      isItemEqualToValue={(opcao, atual) => opcao.id === atual.id}
      filter={(opcao, consulta) => normalizar(opcao.nome).includes(normalizar(consulta.trim()))}
      disabled={disabled}
    >
      <ComboboxInputGroup>
        <ComboboxInput placeholder={placeholder} aria-label={ariaLabel} aria-invalid={invalid} className="aria-invalid:bg-destructive/10" />
      </ComboboxInputGroup>
      <ComboboxContent className="w-[min(36rem,var(--available-width))] min-w-[min(var(--anchor-width),var(--available-width))]">
        {(grupo: GrupoCategoria) => {
          const natureza = naturezaFinanceiraDoGrupo(grupo.value);
          const estilo = estilosNaturezaFinanceira[natureza];
          return (
            <ComboboxGroup key={grupo.value} items={grupo.items} data-natureza-financeira={natureza.toLowerCase()}>
              <ComboboxGroupLabel className={`flex items-center gap-2 pt-2 font-semibold ${estilo.texto}`}>
                <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${estilo.ponto}`} />
                <span>{grupoDreLabels[grupo.value]}</span>
                <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] leading-none ${estilo.indicador}`}>{estilo.rotulo}</span>
              </ComboboxGroupLabel>
              <ComboboxCollection>
                {(opcao: OpcaoCategoria) => (
                  <ComboboxItem key={opcao.id} value={opcao} title={opcao.nome} className="items-start py-2">
                    <span aria-hidden="true" className={`mt-1.5 size-1.5 shrink-0 rounded-full ${estilo.ponto}`} />
                    <span className="min-w-0 whitespace-normal break-words leading-snug">{opcao.nome}</span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          );
        }}
      </ComboboxContent>
    </Combobox>
  );
}
