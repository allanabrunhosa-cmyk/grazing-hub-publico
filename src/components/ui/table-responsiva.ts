"use client";

import { useEffect, useRef } from "react";

/** Barra nativa: sincronização, toque e teclado pertencem ao próprio scrollport.
 * Tabelas largas e longas ganham altura delimitada, sem controles sobre as linhas.
 */
export function useTabelaResponsiva(identificacao?: number | null) {
  const scrollport = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const area = scrollport.current, tabela = table.current;
    if (!area || !tabela) return;
    let frame = 0;
    let recalculoCompleto = true;
    const largurasOriginais = new Map<HTMLTableColElement, { largura: string; medida: number }>();
    function medir() {
      frame = 0;
      if (!area || !tabela) return;
      const excede = area.scrollWidth > area.clientWidth + 1;
      area.dataset.overflow = String(excede);
      const bounds = area.getBoundingClientRect();
      let limite = window.innerHeight;
      let topo = Math.max(0, bounds.top);
      for (let pai = area.parentElement; pai; pai = pai.parentElement) {
        const estilo = getComputedStyle(pai);
        // Bordas arredondadas com overflow:hidden não são scrollports.
        // Usar sua altura de conteúdo criaria um ciclo que encolhe a tabela.
        if (/(auto|scroll)/.test(estilo.overflowY) && (pai.scrollHeight > pai.clientHeight + 1 || estilo.maxHeight !== "none")) {
          const rect = pai.getBoundingClientRect();
          limite = Math.min(limite, rect.bottom); topo = Math.max(topo, rect.top);
        }
      }
      let altura = Math.max(160, limite - topo - 32);
      const anterior = parseFloat(area.style.getPropertyValue("--table-available-height"));
      // Rolar a página não pode aumentar tabelas anteriores e empurrar o foco
      // para fora da tela. A tabela em uso, resize e dados podem ampliar a área.
      if (!recalculoCompleto && !area.contains(document.activeElement) && Number.isFinite(anterior)) altura = Math.min(altura, anterior);
      recalculoCompleto = false;
      area.style.setProperty("--table-available-height", `${altura}px`);
      const headers = tabela.tHead?.rows[0]?.cells;
      const coluna = identificacao === null ? -1 : identificacao ?? (headers ? Array.from(headers).findIndex(cell => Boolean(cell.textContent?.trim()) && !cell.querySelector('[role="checkbox"],input[type="checkbox"]')) : 0);
      const prefixoSelecao = coluna > 0 && headers && Array.from(headers).slice(0, coluna).every(cell => cell.querySelector('[role="checkbox"],input[type="checkbox"]'));
      const fixas = coluna < 0 ? [] : prefixoSelecao ? Array.from({ length: coluna + 1 }, (_, i) => i) : [coluna];
      // Lê apenas o prefixo no cabeçalho antes das escritas; todas as linhas
      // compartilham a geometria das colunas, inclusive em tabelas longas.
      const offsets = new Map<number, number>();
      let offset = 0;
      for (const indice of fixas) {
        offsets.set(indice, offset);
        if (indice !== coluna) offset += (headers?.[indice] ?? tabela.rows[0]?.cells[indice])?.getBoundingClientRect().width ?? 0;
      }
      // Colgroups de editores antigos também precisam respeitar o limite móvel.
      // Conserva a largura original para restaurá-la quando deixa de haver overflow.
      const cols = Array.from(tabela.querySelectorAll<HTMLTableColElement>("colgroup > col"));
      if (cols.every(col => col.span === 1)) for (const [indice, col] of cols.entries()) {
        if (excede && indice === coluna) {
          if (!largurasOriginais.has(col)) largurasOriginais.set(col, { largura: col.style.width, medida: col.getBoundingClientRect().width });
          const largura = `min(${largurasOriginais.get(col)!.medida}px, 18rem, 38vw)`;
          if (col.style.width !== largura) col.style.width = largura;
        } else if (largurasOriginais.has(col)) {
          col.style.width = largurasOriginais.get(col)!.largura;
          largurasOriginais.delete(col);
        }
      }
      for (const linha of Array.from(tabela.rows)) {
        const simples = Array.from(linha.cells).every(cell => cell.colSpan === 1 && cell.rowSpan === 1);
        for (const cell of Array.from(linha.cells)) {
          const fixa = excede && simples && fixas.includes(cell.cellIndex);
          if (fixa) {
            const tipo = cell.cellIndex === coluna ? "identificacao" : "selecao";
            const esquerda = `${offsets.get(cell.cellIndex) ?? 0}px`;
            if (cell.dataset.tableFrozen !== tipo) cell.dataset.tableFrozen = tipo;
            if (cell.style.getPropertyValue("--table-sticky-left") !== esquerda) cell.style.setProperty("--table-sticky-left", esquerda);
          } else if (cell.hasAttribute("data-table-frozen")) { delete cell.dataset.tableFrozen; cell.style.removeProperty("--table-sticky-left"); }
        }
      }
    }
    const agendar = () => { if (!frame) frame = requestAnimationFrame(medir); };
    const atualizar = () => { recalculoCompleto = true; agendar(); };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(atualizar);
    resize?.observe(area); resize?.observe(tabela);
    const mutation = new MutationObserver(atualizar);
    mutation.observe(tabela, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", atualizar); window.addEventListener("scroll", agendar, true);
    area.addEventListener("focusin", atualizar);
    window.visualViewport?.addEventListener("resize", atualizar);
    medir();
    return () => { cancelAnimationFrame(frame); resize?.disconnect(); mutation.disconnect(); window.removeEventListener("resize", atualizar); window.removeEventListener("scroll", agendar, true); area.removeEventListener("focusin", atualizar); window.visualViewport?.removeEventListener("resize", atualizar); for (const [col, original] of largurasOriginais) col.style.width = original.largura; };
  }, [identificacao]);
  return { scrollport, table };
}
