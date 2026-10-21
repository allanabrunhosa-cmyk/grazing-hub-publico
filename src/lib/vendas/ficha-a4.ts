/** Mantém todo o conteúdo dentro da área útil de uma única folha A4 paisagem. */
export function ajustarFichaA4(documento: Document) {
  const pagina = documento.querySelector<HTMLElement>(".pagina-ficha");
  const ficha = documento.querySelector<HTMLElement>(".ficha-produto");
  if (!pagina || !ficha) return 1;
  pagina.style.setProperty("--escala-ficha", "1");
  const tamanho = ficha.getBoundingClientRect();
  const largura = Math.max(1, ficha.scrollWidth, tamanho.width);
  const altura = Math.max(1, ficha.scrollHeight, tamanho.height);
  const escala = Math.min(1, (pagina.clientWidth - 1) / largura, (pagina.clientHeight - 1) / altura);
  pagina.style.setProperty("--escala-ficha", String(escala));
  return escala;
}

/** Função autocontida, também executada pela janela independente de impressão. */
export function scriptAjusteFichaA4() {
  return `<script>(function () {
    function ajustar() { (${ajustarFichaA4.toString()})(document); }
    ajustar();
    window.addEventListener("load", ajustar);
    window.addEventListener("beforeprint", ajustar);
    if (document.fonts) document.fonts.ready.then(ajustar);
    Array.from(document.images).forEach(function (imagem) {
      imagem.addEventListener("load", ajustar);
      imagem.addEventListener("error", ajustar);
    });
  }());</script>`;
}
