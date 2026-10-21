"use client";

import { useEffect, useRef } from "react";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";
import { EtiquetaPreview } from "./etiqueta-preview";

/** Ajusta somente a escala da prévia no desktop. O layout físico/ZPL não muda. */
export function PreviaEmissao({ dados }: { dados: DadosEtiqueta }) {
  const area = useRef<HTMLElement>(null);
  useEffect(() => {
    let quadro = 0;
    function atualizar() {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const svg = area.current?.querySelector("svg");
        if (!svg) return;
        if (window.innerWidth < 1280) { svg.style.removeProperty("max-width"); return; }
        const papel = svg.parentElement!;
        const nota = papel.querySelector("p");
        const moldura = area.current?.closest(".estrutura-sistema");
        const margemInferior = moldura ? parseFloat(getComputedStyle(moldura).paddingBottom) : 16;
        const rodape = parseFloat(getComputedStyle(papel).paddingBottom) + (nota ? nota.getBoundingClientRect().height + parseFloat(getComputedStyle(nota).marginTop) : 0);
        const altura = window.innerHeight - margemInferior - (svg.getBoundingClientRect().top + window.scrollY) - rodape;
        const proporcao = svg.viewBox.baseVal.width / svg.viewBox.baseVal.height;
        svg.style.maxWidth = `${Math.min(480, Math.max(160, altura) * proporcao)}px`;
      });
    }
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(atualizar);
    if (area.current) observador?.observe(area.current);
    window.addEventListener("resize", atualizar);
    atualizar();
    return () => { cancelAnimationFrame(quadro); observador?.disconnect(); window.removeEventListener("resize", atualizar); };
  }, [dados]);
  return <section ref={area} aria-label="Prévia da etiqueta"><EtiquetaPreview dados={dados} /></section>;
}
