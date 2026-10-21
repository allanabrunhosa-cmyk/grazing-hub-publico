// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { mimeFotoVenda } from "@/lib/vendas/foto";
import { gerarFichaProduto } from "@/lib/vendas/ficha";
import type { ProdutoEntrada } from "@/lib/vendas/dominio";
import { produtoTeste } from "./dominio.test";
describe("foto e ficha de produto", () => {
  it("mantém porção e especificação comercial, sem especificação de compra dos ingredientes", () => {
    const html = gerarFichaProduto({ ...produtoTeste, especificacao: "Tábua para compartilhar", componentes: [
      { insumoId: "damasco", quantidade: "0.08", unidade: "KG", observacaoPorcao: "8 un", exibirFicha: true },
    ] }, { categorias: [], grupos: [], insumos: [
      { id: "damasco", nome: "Damasco turco seco", especificacao: "12.5kg cada caixa", categoriaNome: "Frutas", tipo: "INSUMO", unidade: "KG", ativo: true, custo: 69 },
    ] });
    expect(html).toContain("Damasco turco seco");
    expect(html).toContain("8 un");
    expect(html).toContain("0,08 KG");
    expect(html).toContain("Tábua para compartilhar");
    expect(html).not.toContain("12.5kg cada caixa");
  });
  it("recusa SVG, conteúdo arbitrário e imagens muito grandes", () => {
    expect(mimeFotoVenda(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).toBeNull();
    expect(mimeFotoVenda(new Uint8Array(2097153))).toBeNull();
    expect(mimeFotoVenda(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]))).toBe("image/png");
  });
  it("escapa texto no documento de impressão e não soma alternativas", () => {
    const p: ProdutoEntrada = { id: "p", versao: 1, nome: '<img src=x onerror="alert(1)">', tipo: "PERSONALIZADO", especificacao: null, descricao: null, codigo: null, unidade: "UN", fotoUrl: null, observacoes: "<script>alert(1)</script>", modoPreparo: null, ativo: true, categorias: [], grupos: [], preco: "0", componentes: [] };
    const html = gerarFichaProduto(p, { categorias: [], grupos: [], insumos: [] });
    expect(html).not.toContain('<img src=x'); expect(html).not.toContain('<script>alert'); expect(html).toContain("&lt;script&gt;"); expect(html).toContain("Ficha-mestre"); expect(html).toContain("A4 landscape");
    expect(html).toContain('class="pagina-ficha"');
    expect(html).toContain('class="ficha-produto"');
    expect(html).toContain("height:193mm");
    expect(html).toContain('window.addEventListener("beforeprint", ajustar)');
  });
  it("organiza informações de produção sob a foto e separa categoria da porção", () => {
    const p: ProdutoEntrada = { id: "p", versao: 1, nome: "Produto", tipo: "PADRAO", especificacao: null, descricao: null, codigo: null, unidade: "UN", fotoUrl: "/foto.png", observacoes: "Manter refrigerado.", tempoPreparoMinutos: 15, modoPreparo: null, ativo: true, categorias: ["c"], grupos: [], preco: "0", componentes: [{ insumoId: "i", quantidade: "0.05", unidade: "KG", observacaoPorcao: "2 fatias" }] };
    const html = gerarFichaProduto(p, { categorias: [{ id: "c", nome: "Tábuas", ativo: true, versao: 1, ordem: 0, produtos: [] }], grupos: [], insumos: [{ id: "i", nome: "Queijo <especial>", especificacao: "Fatiado", categoriaNome: "Queijos & laticínios", unidade: "KG", tipo: "INSUMO", ativo: true, custo: 10 }] });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const aside = doc.querySelector("aside")!;
    expect(aside.querySelector(".foto img")?.getAttribute("src")).toBe("/foto.png");
    expect(aside.querySelector(".meta")?.textContent).toContain("Tábuas");
    expect(Array.from(aside.querySelectorAll("h2")).map(h => h.textContent)).toEqual(["Tempo de preparo", "Observações"]);
    expect(aside.textContent).toContain("15 minutos");
    expect(aside.textContent).toContain("Manter refrigerado.");
    expect(aside.textContent!.indexOf("Tábuas")).toBeLessThan(aside.textContent!.indexOf("Tempo de preparo"));
    expect(doc.querySelector("article")?.textContent).not.toContain("Tempo de preparo");
    expect(doc.querySelector("article")?.textContent).not.toContain("Manter refrigerado.");
    expect(Array.from(doc.querySelectorAll(".ingredientes th")).map(h => h.textContent)).toEqual(["Ingrediente", "Categoria", "Porção de montagem", "Qtd. estoque"]);
    expect(Array.from(doc.querySelectorAll(".ingredientes tbody td")).map(c => c.textContent)).toEqual(["Queijo <especial>", "Queijos & laticínios", "2 fatias", "0,05 KG"]);
    expect(doc.querySelector(".ingredientes")?.textContent).not.toContain("Fatiado");
    expect(doc.querySelector(".nome-ingrediente")?.querySelector("especial")).toBeNull();
    const vazia = new DOMParser().parseFromString(gerarFichaProduto({ ...p, componentes: [] }, { categorias: [], grupos: [], insumos: [] }), "text/html");
    expect(vazia.querySelector(".ingredientes tbody td")?.getAttribute("colspan")).toBe("4");
  });
});
