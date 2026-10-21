"use client";

import { SelecaoFormulario } from "@/components/ui/select";
import { useState, type ComponentProps } from "react";
import { cn } from "cn";
import { useFracaoMascarada } from "@/components/use-fracao-mascarada";
import { Input } from "@/components/ui/input";

type Propriedades = Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type"> & {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (valor: string) => void;
  permitirNegativo?: boolean;
  containerClassName?: string;
};

function normalizarValor(valor: string | number): string {
  if (valor === "") return "";
  const numero = typeof valor === "number" ? valor : Number(valor.replace(",", "."));
  return Number.isFinite(numero) ? numero.toFixed(2) : "";
}

/** Valores recebidos/enviados são decimais sem milhares; a digitação representa centavos. */
export function CurrencyInput({ name, value, defaultValue = "", onValueChange, permitirNegativo = false, containerClassName, disabled, onKeyDown, onPaste, onBlur, className, ...propriedades }: Propriedades) {
  const [valorInterno, definirValor] = useState(() => normalizarValor(defaultValue));
  const valor = value === undefined ? valorInterno : normalizarValor(value);
  const [negativo, definirNegativo] = useState(() => Number(normalizarValor(value ?? defaultValue)) < 0);
  const numero = Math.abs(Number(valor));
  const exibido = valor === "" ? "" : numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function atualizar(novoValor: string) {
    definirValor(novoValor);
    onValueChange?.(novoValor);
  }

  const fracao = useFracaoMascarada(valor, atualizar, 12, permitirNegativo && negativo ? -1 : 1);

  const campo = <div className={cn("relative min-w-0", permitirNegativo ? "flex-1" : containerClassName)}>
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-sm text-muted-foreground">R$</span>
    <Input {...propriedades} className={cn("pl-10", className)} type="text" inputMode="numeric" disabled={disabled} value={fracao.texto ?? exibido} placeholder={propriedades.placeholder ?? "0,00"}
      onPaste={evento => {
        onPaste?.(evento);
        if (evento.defaultPrevented || fracao.aoColar(evento)) return;
        const texto = evento.clipboardData.getData("text").trim();
        // O prefixo monetário conhecido é aceito somente na colagem; texto arbitrário é recusado.
        if (!/^(?:R\$\s*)?[\d.,\s]+$/.test(texto)) { evento.preventDefault(); return; }
        const el = evento.currentTarget, digitosColados = texto.replace(/\D/g, "");
        const proposta = (el.value.slice(0, el.selectionStart ?? 0) + digitosColados + el.value.slice(el.selectionEnd ?? el.value.length)).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        evento.preventDefault();
        if (proposta.length > 12) return;
        atualizar(proposta ? ((Number(proposta) / 100) * (permitirNegativo && negativo ? -1 : 1)).toFixed(2) : "");
      }}
      onKeyDown={(evento) => {
        onKeyDown?.(evento);
        if (fracao.aoTeclar(evento)) return;
        if (!evento.ctrlKey && !evento.metaKey && !evento.altKey && evento.key.length === 1 && !/\d/.test(evento.key)) evento.preventDefault();
      }}
      onBlur={evento => { fracao.aoSair(); onBlur?.(evento); }}
      onChange={(evento) => {
        if (fracao.aoEditar(evento)) return;
        const digitos = evento.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
        const apagando = (evento.nativeEvent as InputEvent).inputType?.startsWith("delete");
        if (apagando && numero === 0 && Number(digitos) === 0) { atualizar(""); return; }
        atualizar(digitos ? ((Number(digitos) / 100) * (permitirNegativo && negativo ? -1 : 1)).toFixed(2) : "");
      }} />
  </div>;

  const campoOculto = name ? <input type="hidden" name={name} value={valor} disabled={disabled} /> : null;

  if (!permitirNegativo) return <>{campoOculto}{campo}</>;
  return <div className={cn("flex gap-2", containerClassName)}>
    {campoOculto}
    <SelecaoFormulario aria-label="Sinal do saldo" className="w-fit shrink-0" disabled={disabled} value={negativo ? "negativo" : "positivo"}
     onValueChange={(novoValor) => {
        const novoNegativo = novoValor === "negativo";
        definirNegativo(novoNegativo);
        atualizar(valor === "" ? "" : (numero * (novoNegativo ? -1 : 1)).toFixed(2));
      }}>
      <option value="positivo">Positivo</option><option value="negativo">Negativo</option>
    </SelecaoFormulario>
    {campo}
  </div>;
}
