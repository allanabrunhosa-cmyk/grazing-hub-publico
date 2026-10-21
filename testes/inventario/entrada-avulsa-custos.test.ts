import { describe, expect, it } from "vitest";
import { calcularCompraSemNota } from "@/lib/inventario/entrada-avulsa";

const itens = [
  { insumoId: "queijo", localId: "cozinha", quantidade: 10, valorProdutos: 100 },
  { insumoId: "presunto", localId: "cozinha", quantidade: 30, valorProdutos: 300 },
];

describe("composição da compra sem nota", () => {
  it("rateia frete, desconto e custos adicionais e fecha o total em centavos", () => {
    const resultado = calcularCompraSemNota({
      itens,
      frete: 40,
      desconto: 20,
      custosAdicionais: [{ descricao: "Descarga", valor: 25 }],
    });

    expect(resultado).toEqual({
      composicao: expect.objectContaining({
        valorProdutos: 400,
        frete: 40,
        desconto: 20,
        outrosCustos: 25,
        valorTotal: 445,
        itens: [
          expect.objectContaining({ freteRateado: 10, descontoRateado: 5, outrosCustosRateados: 6.25, valorFinal: 111.25, custoUnitario: 11.125 }),
          expect.objectContaining({ freteRateado: 30, descontoRateado: 15, outrosCustosRateados: 18.75, valorFinal: 333.75, custoUnitario: 11.125 }),
        ],
      }),
    });
  });

  it("distribui os centavos sem perder ou criar valor", () => {
    const resultado = calcularCompraSemNota({
      itens: [
        { insumoId: "a", localId: "l", quantidade: 1, valorProdutos: 1 },
        { insumoId: "b", localId: "l", quantidade: 1, valorProdutos: 1 },
        { insumoId: "c", localId: "l", quantidade: 1, valorProdutos: 1 },
      ],
      frete: 0.01,
      desconto: 0,
      custosAdicionais: [],
    });
    expect(resultado).toHaveProperty("composicao.valorTotal", 3.01);
    if ("composicao" in resultado) {
      expect(resultado.composicao.itens.reduce((soma, item) => soma + Math.round(item.valorFinal * 100), 0)).toBe(301);
    }
  });

  it("converte a quantidade comprada para a unidade de estoque antes de calcular o custo unitário", () => {
    const resultado = calcularCompraSemNota({
      itens: [{ insumoId: "fardo", localId: "l", quantidade: 2, fatorConversao: 10, valorProdutos: 50 }],
      frete: 0,
      desconto: 0,
      custosAdicionais: [],
    });
    expect(resultado).toHaveProperty("composicao.itens[0].quantidadeEstoque", 20);
    expect(resultado).toHaveProperty("composicao.itens[0].custoUnitario", 2.5);
  });

  it("recusa custo incompleto, valor com mais de dois decimais e desconto maior que a compra", () => {
    expect(calcularCompraSemNota({ itens, frete: 0, desconto: 0, custosAdicionais: [{ descricao: "", valor: 10 }] })).toHaveProperty("erro");
    expect(calcularCompraSemNota({ itens, frete: 0.001, desconto: 0, custosAdicionais: [] })).toHaveProperty("erro");
    expect(calcularCompraSemNota({ itens, frete: 0, desconto: 500, custosAdicionais: [] })).toEqual({
      erro: "O valor total da compra deve ser maior que zero.",
    });
    expect(calcularCompraSemNota({ itens, frete: 0, desconto: 400, custosAdicionais: [] })).toEqual({
      erro: "O valor total da compra deve ser maior que zero.",
    });
  });
});
