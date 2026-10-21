"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxCollection,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
} from "@/components/ui/combobox";
import { BotaoRemoverItem } from "@/components/remover-item";

export type OpcaoMultiselecao = { id: string; nome: string; descricao?: string | null; grupo?: string };

type OpcaoInterna = OpcaoMultiselecao & { value: string; label: string };

function normalizar(valor: string) {
  return valor.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function MultiselecaoCombobox({
  opcoes,
  selecionadosIds,
  aoMudar,
  name,
  placeholder,
  ariaLabel,
  vazio = "Nenhuma opção encontrada.",
  disabled,
  mostrarChips = true,
}: {
  opcoes: OpcaoMultiselecao[];
  selecionadosIds: string[];
  aoMudar: (ids: string[]) => void;
  name?: string;
  placeholder: string;
  ariaLabel: string;
  vazio?: string;
  disabled?: boolean;
  mostrarChips?: boolean;
}) {
  const itens: OpcaoInterna[] = opcoes.map((opcao) => ({ ...opcao, value: opcao.id, label: opcao.nome }));
  const grupos = [...new Set(itens.map((item) => item.grupo ?? "Sem grupo"))].map((nome) => ({
    nome,
    items: itens.filter((item) => (item.grupo ?? "Sem grupo") === nome),
  }));
  const agrupado = itens.some((item) => item.grupo);
  const selecionados = itens.filter((item) => selecionadosIds.includes(item.id));
  const textoSelecao = selecionados.length === 0
    ? placeholder
    : `${selecionados.length} ${selecionados.length === 1 ? "selecionado" : "selecionados"} — buscar mais...`;

  return (
    <div className="space-y-1.5">
      <Combobox
        multiple
        items={agrupado ? grupos : itens}
        value={selecionados}
        onValueChange={(novos, detalhes) => {
          if (detalhes.reason === "escape-key") return;
          aoMudar((novos as OpcaoInterna[]).map((item) => item.id));
        }}
        isItemEqualToValue={(item, atual) => item.id === atual.id}
        filter={(item, consulta) => normalizar(`${item.nome} ${item.descricao ?? ""} ${item.grupo ?? ""}`).includes(normalizar(consulta.trim()))}
        name={name}
        disabled={disabled}
      >
        <ComboboxInputGroup>
          <ComboboxInput placeholder={textoSelecao} aria-label={ariaLabel} />
        </ComboboxInputGroup>
        <ComboboxContent className="max-h-64" emptyLabel={vazio}>
          {agrupado ? (grupo: { nome: string; items: OpcaoInterna[] }) => (
            <ComboboxGroup key={grupo.nome} items={grupo.items}>
              <ComboboxGroupLabel className="pt-2 font-semibold">{grupo.nome}</ComboboxGroupLabel>
              <ComboboxCollection>{(item: OpcaoInterna) => <ComboboxItem key={item.id} value={item} className="py-2">
                <span className="min-w-0 whitespace-normal break-words leading-snug"><span className="block">{item.nome}</span>{item.descricao ? <span className="mt-0.5 block text-xs text-muted-foreground">{item.descricao}</span> : null}</span>
              </ComboboxItem>}</ComboboxCollection>
            </ComboboxGroup>
          ) : (item: OpcaoInterna) => (
            <ComboboxItem key={item.id} value={item} className="py-2">
              <span className="min-w-0 whitespace-normal break-words leading-snug">
                <span className="block">{item.nome}</span>
                {item.descricao ? <span className="mt-0.5 block text-xs text-muted-foreground">{item.descricao}</span> : null}
              </span>
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>
      {mostrarChips && selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={`${ariaLabel} selecionados`}>
          {selecionados.map((item) => (
            <span
              key={item.id}
              data-slot="multiselecao-chip"
              data-disabled={disabled ? "" : undefined}
              className="inline-flex max-w-full items-center gap-1 rounded-[var(--ds-botao-raio)] border border-primary/20 bg-primary/10 pr-1 pl-2.5 text-xs text-primary"
            >
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                <span className="block">{item.nome}</span>
                {item.descricao ? <span className="block text-[10px] opacity-75">{item.descricao}</span> : null}
              </span>
              <BotaoRemoverItem discreto
                nome={`Remover ${item.nome}`}
                disabled={disabled}
                data-dialogo-altera
                onClick={() => aoMudar(selecionados.filter((selecionado) => selecionado.id !== item.id).map((selecionado) => selecionado.id))}
              />
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground" role="status">
        {selecionados.length === 0
          ? "Nenhuma opção selecionada."
          : `${selecionados.length} ${selecionados.length === 1 ? "opção selecionada" : "opções selecionadas"}.`}
      </p>
    </div>
  );
}
