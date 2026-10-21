// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ajustarFichaA4, scriptAjusteFichaA4 } from "@/lib/vendas/ficha-a4";

function documento(largura: number, altura: number) {
  document.body.innerHTML = '<div class="pagina-ficha"><div class="ficha-produto">Último ingrediente e rodapé</div></div>';
  const pagina = document.querySelector<HTMLElement>(".pagina-ficha")!;
  const ficha = document.querySelector<HTMLElement>(".ficha-produto")!;
  Object.defineProperties(pagina, { clientWidth: { value: 1062 }, clientHeight: { value: 729 } });
  Object.defineProperties(ficha, { scrollWidth: { value: largura }, scrollHeight: { value: altura, configurable: true } });
  return { pagina, ficha };
}

afterEach(() => { document.body.innerHTML = ""; });

describe("uma folha A4 paisagem", () => {
  it.each([[1062, 600], [1062, 3000], [4000, 900], [1062, 100000]])("encaixa %s × %s sem cortar conteúdo ou impor escala mínima", (largura, altura) => {
    const { pagina, ficha } = documento(largura, altura);
    const escala = ajustarFichaA4(document);
    expect(largura * escala).toBeLessThanOrEqual(pagina.clientWidth - 1);
    expect(altura * escala).toBeLessThanOrEqual(pagina.clientHeight - 1);
    expect(ficha.textContent).toContain("Último ingrediente e rodapé");
    expect(Number(pagina.style.getPropertyValue("--escala-ficha"))).toBe(escala);
    expect(ajustarFichaA4(document)).toBe(escala);
  });
  it("recalcula antes de imprimir quando o conteúdo muda", () => {
    const { pagina, ficha } = documento(1062, 600);
    const primeira = ajustarFichaA4(document);
    const script = scriptAjusteFichaA4().replace(/^<script>|<\/script>$/g, "");
    new window.Function("window", "document", script)(window, document);
    Object.defineProperty(ficha, "scrollHeight", { value: 3000, configurable: true });
    window.dispatchEvent(new window.Event("beforeprint"));
    expect(Number(pagina.style.getPropertyValue("--escala-ficha"))).toBeLessThan(primeira);
    expect(3000 * Number(pagina.style.getPropertyValue("--escala-ficha"))).toBeLessThanOrEqual(728);
  });
});
