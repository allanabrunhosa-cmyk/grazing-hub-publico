"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

export type PendenciaFormulario = { alvo: HTMLElement; mensagem: string };

function localizarControle(alvo?: HTMLElement) {
  if (alvo?.matches('input:not([type="hidden"]),select,textarea,button')) return alvo;
  return alvo?.querySelector<HTMLElement>('input:not([type="hidden"]):not([readonly]):not(:disabled),[role="combobox"]:not(:disabled),button:not(:disabled)') ?? alvo?.querySelector<HTMLElement>("summary");
}

/** Abre detalhes, associa o erro ao controle e leva foco/rolagem até a pendência. */
export function MensagemPendenciaFormulario({ pendencia, bloqueado = false }: { pendencia: PendenciaFormulario | null; bloqueado?: boolean }) {
  const id = useId();
  const alvo = pendencia?.alvo;
  const controle = localizarControle(alvo);
  const recipiente = alvo?.closest<HTMLElement>("[data-erro-container]") ?? controle?.closest("label")?.parentElement ?? alvo;
  useEffect(() => {
    // Resolver após o commit: o fieldset pode estar desabilitado durante a confirmação.
    const controle = localizarControle(alvo);
    if (!pendencia || !controle || bloqueado) return;
    const atributos = { invalido: controle.getAttribute("aria-invalid"), descricao: controle.getAttribute("aria-describedby") };
    controle.setAttribute("aria-invalid", "true");
    controle.setAttribute("aria-describedby", [atributos.descricao, id].filter(Boolean).join(" "));
    let pai = controle.parentElement;
    while (pai) { if (pai instanceof HTMLDetailsElement) pai.open = true; pai = pai.parentElement; }
    controle.focus({ preventScroll: true });
    controle.scrollIntoView?.({ block: "center", behavior: "auto" });
    return () => {
      const anteriores: [string, string | null][] = [["aria-invalid", atributos.invalido], ["aria-describedby", atributos.descricao]];
      for (const [nome, anterior] of anteriores) {
        if (anterior === null) controle.removeAttribute(nome); else controle.setAttribute(nome, anterior);
      }
    };
  }, [pendencia, alvo, id, bloqueado]);
  return pendencia && recipiente ? createPortal(<p id={id} role="alert" className="col-span-full text-xs font-normal text-destructive">{pendencia.mensagem}</p>, recipiente) : null;
}
