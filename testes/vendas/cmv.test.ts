import { describe, expect, it } from "vitest";
import { custoComposicaoProduto, percentualCmv } from "@/lib/vendas/cmv";

describe("CMV da porção por canal", () => {
  const produto = { componentes: [{ insumoId: "queijo", quantidade: "0.15", unidade: "KG", observacaoPorcao: "3 fatias" }] };
  const insumos = [{ id: "queijo", unidade: "KG", custo: 80, ativo: true }];
  it("calcula o consumo real, não o custo do quilo, e considera o preço promocional", () => {
    const custo = custoComposicaoProduto(produto, insumos);
    expect(custo).toBe(12);
    expect(percentualCmv(custo, "60")).toBe(20);
    expect(percentualCmv(custo, "50")).toBe(24);
    expect(percentualCmv(custo, "0")).toBeNull();
  });
  it("não disfarça dados incompletos como custo zero", () => {
    expect(custoComposicaoProduto({ componentes: [] }, insumos)).toBeNull();
    expect(custoComposicaoProduto(produto, [])).toBeNull();
    expect(custoComposicaoProduto(produto, [{ ...insumos[0], ativo: false }])).toBeNull();
    expect(custoComposicaoProduto(produto, [{ ...insumos[0], custo: null }])).toBeNull();
    expect(custoComposicaoProduto(produto, [{ ...insumos[0], unidade: "UN" }])).toBeNull();
  });
});
