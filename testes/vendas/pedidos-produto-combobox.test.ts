import { expect, it } from "vitest";
import { agruparProdutosPedido } from "@/app/(protegido)/vendas/pedidos/produto-pedido-combobox";

it("agrupa cada produto uma vez pela primeira categoria comercial e conserva os sem categoria", () => {
  const grupos = agruparProdutosPedido([
    { value: "p1", label: "Kit fictício", categorias: ["c1", "c2"], indisponivel: false },
    { value: "p2", label: "Tábua fictícia", categorias: ["c2"], indisponivel: false },
    { value: "p3", label: "Produto avulso fictício", categorias: [], indisponivel: false },
  ], [{ id: "c2", nome: "Tábuas" }, { id: "c1", nome: "Kits" }]);
  expect(grupos.map(g => [g.nome, g.items.map(p => p.label)])).toEqual([
    ["Tábuas", ["Tábua fictícia"]],
    ["Kits", ["Kit fictício"]],
    ["Sem categoria", ["Produto avulso fictício"]],
  ]);
});

it("segmenta opções avulsas pelo grupo sem duplicá-las nas categorias de produtos", () => {
  const grupos = agruparProdutosPedido([
    { value: "p", label: "Produto", categorias: ["c"], indisponivel: false },
    { value: "opcao:g:o", label: "Porção", categorias: [], indisponivel: false, secao: { id: "complemento:g", nome: "Complementos" } },
  ], [{ id: "c", nome: "Categoria" }]);
  expect(grupos.map(g => [g.nome, g.items.map(o => o.label)])).toEqual([["Categoria", ["Produto"]], ["Complementos", ["Porção"]]]);
});
