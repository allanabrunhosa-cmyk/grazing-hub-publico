"use client";

import { Textarea } from "@/components/ui/textarea";

/** Preserva parágrafos e remove somente controles proibidos; o servidor revalida o domínio fiscal. */
export function normalizarTextoFormularioFiscal(valor: string, maximo: number): string {
  return valor.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").slice(0, maximo);
}
export function TextareaFiscal({ nome, valor, maximo, mudar }: { nome: string; valor: string; maximo: number; mudar: (valor: string) => void }) {
  return <Textarea aria-label={nome} maxLength={maximo} value={valor} onChange={e => mudar(normalizarTextoFormularioFiscal(e.target.value, maximo))} onPaste={e => {
    const el = e.currentTarget, bruto = e.clipboardData.getData("text");
    const inicio = el.selectionStart, fim = el.selectionEnd;
    const restante = maximo - (el.value.length - (fim - inicio));
    const inserido = normalizarTextoFormularioFiscal(bruto, Math.max(0, restante));
    if (inserido === bruto) return;
    e.preventDefault();
    mudar(el.value.slice(0, inicio) + inserido + el.value.slice(fim));
    const cursor = inicio + inserido.length;
    queueMicrotask(() => { if (el.isConnected) el.setSelectionRange(cursor, cursor); });
  }} />;
}
