"use client";

import { useState } from "react";
import { cn } from "cn";
import { ComboboxInput, ComboboxInputGroup } from "@/components/ui/combobox";
import { IdentificacaoInsumo, type DadosIdentificacaoInsumo } from "@/components/identificacao-insumo";

export function CampoBuscaInsumo({
  selecionado,
  placeholder = "Buscar insumo...",
  invalido = false,
  ariaLabel,
  className,
}: {
  selecionado: DadosIdentificacaoInsumo | null;
  placeholder?: string;
  invalido?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [focado, setFocado] = useState(false);
  const mostrarIdentificacao = Boolean(selecionado && !focado);

  return (
    <ComboboxInputGroup>
      <ComboboxInput
        aria-invalid={invalido}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        className={cn(
          "aria-invalid:bg-destructive/10",
          mostrarIdentificacao && "text-transparent caret-transparent",
          className,
        )}
      />
      {mostrarIdentificacao && selecionado ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-8 left-8 z-10 flex min-w-0 items-center">
          <IdentificacaoInsumo
            nome={selecionado.nome}
            nomeClassName="truncate font-medium text-foreground"
            especificacaoClassName="truncate"
          />
        </span>
      ) : null}
    </ComboboxInputGroup>
  );
}
