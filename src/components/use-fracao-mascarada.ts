"use client";

import { useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { aceitaEdicaoCampo, completarZeroDecimal } from "@/lib/campos-entrada";

/** Atalho decimal explícito para máscaras que normalmente recebem centavos. */
export function useFracaoMascarada(valor: string, alterar: (valor: string) => void, maximoDigitos: number, sinal = 1) {
  const [edicao, definirEdicao] = useState<{ texto: string; base: string } | null>(null);
  const texto = edicao?.base === valor ? edicao.texto : null;
  function aplicar(bruto: string, campo: HTMLInputElement) {
    if (campo.readOnly || campo.matches(":disabled")) return;
    const normalizado = completarZeroDecimal(bruto);
    if (!aceitaEdicaoCampo(normalizado, "decimal", Math.min(maximoDigitos + 1, campo.maxLength >= 0 ? campo.maxLength : maximoDigitos + 1), 2, false) || normalizado.replace(/\D/g, "").length > maximoDigitos) {
      campo.value = texto ?? campo.value;
      return;
    }
    const [inteira, decimal = ""] = normalizado.replace(",", ".").split(".");
    const magnitude = `${inteira.replace(/^0+(?=\d)/, "") || "0"}.${decimal.padEnd(2, "0")}`;
    const novo = normalizado === "" ? "" : `${sinal < 0 && /[1-9]/.test(magnitude) ? "-" : ""}${magnitude}`;
    definirEdicao(normalizado === "" ? null : { texto: normalizado, base: novo });
    alterar(novo);
  }
  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.defaultPrevented) return true;
    const campo = evento.currentTarget;
    if (campo.readOnly || campo.matches(":disabled")) return false;
    const substituir = campo.value === "" || /^0(?:[.,]0*)?$/.test(campo.value) || (campo.selectionStart === 0 && campo.selectionEnd === campo.value.length);
    if (!evento.ctrlKey && !evento.metaKey && !evento.altKey && /^[.,]$/.test(evento.key) && substituir) {
      evento.preventDefault(); aplicar(evento.key, campo); return true;
    }
    if (texto !== null) {
      if (!evento.ctrlKey && !evento.metaKey && !evento.altKey && evento.key.length === 1 && !/[\d.,]/.test(evento.key)) evento.preventDefault();
      return true;
    }
    return false;
  }
  function aoEditar(evento: ChangeEvent<HTMLInputElement>) {
    if (texto === null && !/^[.,]/.test(evento.target.value)) return false;
    aplicar(evento.target.value, evento.currentTarget); return true;
  }
  function aoColar(evento: ClipboardEvent<HTMLInputElement>) {
    if (evento.defaultPrevented) return true;
    const colado = evento.clipboardData.getData("text").trim(), campo = evento.currentTarget;
    if (!/^[.,]/.test(colado) && texto === null) return false;
    evento.preventDefault();
    const proposta = campo.value.slice(0, campo.selectionStart ?? 0) + colado + campo.value.slice(campo.selectionEnd ?? campo.value.length);
    aplicar(proposta, campo); return true;
  }
  return { texto, aoTeclar, aoEditar, aoColar, aoSair: () => definirEdicao(null) };
}
