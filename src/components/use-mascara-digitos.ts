"use client";

import { useLayoutEffect, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { aceitaEdicaoCampo } from "@/lib/campos-entrada";

export type MascaraDigitos = "CPF" | "CNPJ" | "CEP";
const configuracoes = {
  CPF: { grupos: [3, 3, 3, 2], separadores: [".", ".", "-"], limite: 11, tamanho: 14, pattern: "[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}" },
  CNPJ: { grupos: [2, 3, 3, 4, 2], separadores: [".", ".", "/", "-"], limite: 14, tamanho: 18, pattern: "[0-9]{2}\\.[0-9]{3}\\.[0-9]{3}\\/[0-9]{4}-[0-9]{2}" },
  CEP: { grupos: [5, 3], separadores: ["-"], limite: 8, tamanho: 9, pattern: "[0-9]{5}-[0-9]{3}" },
} as const;
const digitos = (texto: string) => texto.replace(/\D/g, "");
const textoPermitido = (texto: string) => aceitaEdicaoCampo(texto, "mascara-numerica", 2000) && /^[\d.\-/\s]*$/.test(texto);

/** A máscara não oculta dígitos excedentes de um valor legado inválido. */
export function formatarMascaraDigitos(valor: string, tipo: MascaraDigitos) {
  const numeros = digitos(valor), config = configuracoes[tipo];
  let inicio = 0, resultado = "";
  for (const [indice, tamanho] of config.grupos.entries()) {
    if (inicio >= numeros.length) break;
    if (indice) resultado += config.separadores[indice - 1];
    resultado += numeros.slice(inicio, indice === config.grupos.length - 1 ? undefined : inicio + tamanho);
    inicio += tamanho;
  }
  return resultado;
}

function posicaoPorDigitos(texto: string, quantidade: number) {
  if (quantidade <= 0) return 0;
  let vistos = 0;
  for (let indice = 0; indice < texto.length; indice++) if (/\d/.test(texto[indice]) && ++vistos === quantidade) return indice + 1;
  return texto.length;
}

/** Input oficial protege caracteres; este adaptador conserva a seleção e emite apenas dígitos. */
export function useMascaraDigitos(valor: string, tipo: MascaraDigitos, alterar: (digitos: string) => void) {
  const config = configuracoes[tipo], value = formatarMascaraDigitos(valor, tipo);
  const selecao = useRef<{ campo: HTMLInputElement; inicio: number; fim: number } | null>(null);
  function restaurar(plano = selecao.current) {
    if (!plano || selecao.current !== plano) return;
    if (plano.campo.isConnected && document.activeElement === plano.campo) plano.campo.setSelectionRange(plano.inicio, plano.fim);
    selecao.current = null;
  }
  useLayoutEffect(() => { restaurar(); });
  function aplicar(campo: HTMLInputElement, numeros: string, inicioDigitos: number, fimDigitos = inicioDigitos) {
    const formatado = formatarMascaraDigitos(numeros, tipo);
    campo.value = formatado;
    const plano = { campo, inicio: posicaoPorDigitos(formatado, inicioDigitos), fim: posicaoPorDigitos(formatado, fimDigitos) };
    selecao.current = plano;
    if (numeros !== digitos(valor)) alterar(numeros);
    queueMicrotask(() => restaurar(plano));
  }
  const bloqueado = (campo: HTMLInputElement) => campo.readOnly || campo.matches(":disabled");
  function onChange(evento: ChangeEvent<HTMLInputElement>) {
    const campo = evento.currentTarget;
    if (bloqueado(campo)) return;
    const bruto = campo.value, numeros = digitos(bruto), cursor = campo.selectionStart ?? bruto.length;
    if (!textoPermitido(bruto) || numeros.length > config.limite) { campo.value = value; return; }
    const antes = digitos(valor), tipoEntrada = (evento.nativeEvent as InputEvent).inputType;
    if (numeros === antes && bruto.length < value.length && (tipoEntrada === "deleteContentBackward" || tipoEntrada === "deleteContentForward")) {
      const posicao = digitos(bruto.slice(0, cursor)).length - (tipoEntrada === "deleteContentBackward" ? 1 : 0);
      if (posicao >= 0 && posicao < antes.length) { aplicar(campo, antes.slice(0, posicao) + antes.slice(posicao + 1), posicao); return; }
    }
    aplicar(campo, numeros, digitos(bruto.slice(0, cursor)).length, digitos(bruto.slice(0, campo.selectionEnd ?? cursor)).length);
  }
  function onPaste(evento: ClipboardEvent<HTMLInputElement>) {
    evento.preventDefault();
    const campo = evento.currentTarget, texto = evento.clipboardData.getData("text");
    if (bloqueado(campo) || !texto || !textoPermitido(texto)) return;
    const inicio = digitos(campo.value.slice(0, campo.selectionStart ?? campo.value.length)).length;
    const fim = digitos(campo.value.slice(0, campo.selectionEnd ?? campo.value.length)).length;
    const colados = digitos(texto), antes = digitos(campo.value), novos = antes.slice(0, inicio) + colados + antes.slice(fim);
    if (novos.length > config.limite) return;
    aplicar(campo, novos, inicio + colados.length);
  }
  function onKeyDown(evento: KeyboardEvent<HTMLInputElement>) {
    const campo = evento.currentTarget;
    if (bloqueado(campo) || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const inicio = campo.selectionStart ?? campo.value.length, fim = campo.selectionEnd ?? inicio;
    if (evento.key.length === 1 && (!textoPermitido(evento.key) || /\d/.test(evento.key) && digitos(campo.value).length - digitos(campo.value.slice(inicio, fim)).length >= config.limite)) { evento.preventDefault(); return; }
    if (inicio !== fim) return;
    const indice = evento.key === "Backspace" ? inicio - 1 : evento.key === "Delete" ? inicio : -1;
    if (indice < 0 || indice >= campo.value.length || /\d/.test(campo.value[indice])) return;
    const anteriores = digitos(campo.value), apagar = digitos(campo.value.slice(0, inicio)).length - (evento.key === "Backspace" ? 1 : 0);
    if (apagar < 0 || apagar >= anteriores.length) return;
    evento.preventDefault(); aplicar(campo, anteriores.slice(0, apagar) + anteriores.slice(apagar + 1), apagar);
  }
  return { value, maxLength: config.tamanho, pattern: config.pattern, restricao: "mascara-numerica" as const, onChange, onPaste, onKeyDown };
}
