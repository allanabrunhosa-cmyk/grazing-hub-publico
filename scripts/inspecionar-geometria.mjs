/** Medição somente leitura; escopo explícito evita tratar rolagem de tabela como corte. */
export function inspecionarGeometria(seletor) {
  const problemas = [];
  const vistos = new Set();
  const controles = [];
  const identificar = e => e.getAttribute("data-testid") || e.getAttribute("aria-label") || e.id || e.tagName.toLowerCase();
  for (const raiz of document.querySelectorAll(seletor)) {
    for (const e of raiz.querySelectorAll('button[data-slot="button"], a[data-slot="button"], [data-slot="input"], [data-slot="select-trigger"], [data-slot="textarea"]')) {
      if (vistos.has(e)) continue;
      vistos.add(e);
      const css = getComputedStyle(e), r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || css.visibility === "hidden" || css.display === "none" || e.closest('[hidden], [inert]')) continue;
      controles.push({ e, r });
      const paiDireto = e.parentElement;
      if (paiDireto && getComputedStyle(paiDireto).display === "grid") {
        const grade = paiDireto.getBoundingClientRect();
        if (r.left < grade.left - 2 || r.right > grade.right + 2) problemas.push({ regra: "controle-fora-da-grade", controle: identificar(e), grade: identificar(paiDireto) });
      }
      if (e.tagName === "BUTTON" && e.scrollWidth > e.clientWidth + 2 && css.textOverflow !== "ellipsis") problemas.push({ regra: "rotulo-cortado", controle: identificar(e) });
      for (let pai = e.parentElement; pai && pai !== document.body; pai = pai.parentElement) {
        const estilo = getComputedStyle(pai), caixa = pai.getBoundingClientRect();
        const cortaX = ["hidden", "clip", "auto", "scroll"].includes(estilo.overflowX);
        // Rolagem vertical permite conteúdo abaixo da área visível; isso não é corte.
        const cortaY = ["hidden", "clip"].includes(estilo.overflowY);
        if ((cortaX && (r.left < caixa.left - 2 || r.right > caixa.right + 2)) || (cortaY && (r.top < caixa.top - 2 || r.bottom > caixa.bottom + 2))) {
          problemas.push({ regra: "controle-cortado", controle: identificar(e), ancestral: identificar(pai) }); break;
        }
      }
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x >= 0 && x < innerWidth && y >= 0 && y < innerHeight) {
        const superior = document.elementFromPoint(x, y);
        if (superior && !e.contains(superior) && !superior.contains(e)) problemas.push({ regra: "controle-encoberto", controle: identificar(e), superior: identificar(superior) });
      }
    }
  }
  for (let i = 0; i < controles.length; i++) for (let j = i + 1; j < controles.length; j++) {
    const a = controles[i], b = controles[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 2 && y > 2) problemas.push({ regra: "controles-sobrepostos", controles: [identificar(a.e), identificar(b.e)], intersecao: { largura: x, altura: y } });
  }
  return { controles: controles.length, problemas, limite: "Controles no escopo informado; tabelas roláveis, truncamentos intencionais, texto composto e outras sobreposições requerem inspeção visual." };
}
