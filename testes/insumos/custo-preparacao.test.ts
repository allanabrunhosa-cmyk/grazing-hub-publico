import { describe, expect, it } from "vitest";
import { calcularCustoReceita, calcularCustosPreparacoes, type ItemCustoPreparacao } from "@/lib/insumos/custo-preparacao";

const insumo: ItemCustoPreparacao = {
  id: "farinha", tipo: "INSUMO", unidade: "KG", custoMedio: 10,
  rendimentoQuantidade: null, rendimentoUnidade: null, conversoes: [], componentes: [],
};

describe("custo unitário da preparação", () => {
  it("divide o custo dos ingredientes pelo rendimento na unidade de controle", () => {
    expect(calcularCustoReceita([{ quantidade: 2, custoUnitario: 10 }], 4, "KG", "KG", []))
      .toEqual({ total: 20, unitario: 5 });
    expect(calcularCustoReceita([{ quantidade: 2, custoUnitario: 10 }], 2, "KG", "G", []))
      .toEqual({ total: 20, unitario: 0.01 });
    expect(calcularCustoReceita([{ quantidade: 3, custoUnitario: 2 }], 500, "ML", "L", []))
      .toEqual({ total: 6, unitario: 12 });
  });

  it("usa a conversão cadastrada para unidades de embalagem", () => {
    expect(calcularCustoReceita([{ quantidade: 2, custoUnitario: 10 }], 12, "UN", "DZ", [{ unidade: "UN", fator: 1 / 12 }]))
      .toEqual({ total: 20, unitario: 20 });
  });

  it("não inventa custo quando faltam rendimento, ingrediente ou conversão", () => {
    expect(calcularCustoReceita([{ quantidade: 1, custoUnitario: 10 }], null, "KG", "KG", [])).toHaveProperty("motivo");
    expect(calcularCustoReceita([{ quantidade: 1, custoUnitario: null }], 1, "KG", "KG", [])).toHaveProperty("motivo");
    expect(calcularCustoReceita([{ quantidade: 1, custoUnitario: 10 }], 1, "KG", "UN", [])).toHaveProperty("motivo");
  });

  it("compõe o custo de outra preparação e interrompe ciclos", () => {
    const base: ItemCustoPreparacao = {
      ...insumo, id: "massa", tipo: "PRODUTO_INTERMEDIARIO", custoMedio: 999,
      rendimentoQuantidade: 2, rendimentoUnidade: "KG", componentes: [{ componenteId: "farinha", quantidade: 2 }],
    };
    const final: ItemCustoPreparacao = {
      ...base, id: "prato", unidade: "UN", rendimentoQuantidade: 5, rendimentoUnidade: "UN",
      componentes: [{ componenteId: "massa", quantidade: 1 }],
    };
    const custos = calcularCustosPreparacoes([insumo, base, final]);
    expect(custos.get("massa")).toEqual({ total: 20, unitario: 10 });
    expect(custos.get("prato")).toEqual({ total: 10, unitario: 2 });
    const ciclico = calcularCustosPreparacoes([{ ...base, componentes: [{ componenteId: "prato", quantidade: 1 }] }, final]);
    expect(ciclico.get("massa")).toHaveProperty("motivo");
    expect(ciclico.get("prato")).toHaveProperty("motivo");
  });
});
