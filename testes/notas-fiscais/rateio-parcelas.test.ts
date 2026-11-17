import { describe, expect, it } from "vitest";
import { centavos, ratearItensPorDuplicatas, ratearValor } from "@/lib/notas-fiscais/custos";

describe("rateio de itens nas parcelas da NF-e", () => {
  it("fecha as duas parcelas mesmo quando todos os itens têm centavos ímpares", () => {
    expect(ratearItensPorDuplicatas([1.01, 1.01], [1.01, 1.01])).toEqual([[0.51, 0.50], [0.50, 0.51]]);
  });

  it("fecha cada uma das quatro parcelas da compra, sem concentrar os restos na primeira", () => {
    const itens = [49.85, 49.85, 49.82];
    const parcelas = [37.38, 37.38, 37.38, 37.38];
    const matriz = ratearItensPorDuplicatas(itens, parcelas);
    expect(matriz.map(linha => linha.reduce((soma, valor) => soma + centavos(valor), 0))).toEqual(itens.map(centavos));
    expect(parcelas.map((_, indice) => matriz.reduce((soma, linha) => soma + centavos(linha[indice]), 0))).toEqual(parcelas.map(centavos));
    expect(matriz.flat().every(valor => valor >= 0)).toBe(true);
  });

  it("conserva o aceite parcial anterior e preenche o saldo das parcelas no aceite seguinte", () => {
    const primeiro = ratearItensPorDuplicatas([1.01], [1.01, 1.01])[0];
    const segundo = ratearItensPorDuplicatas([1.01], [1.01, 1.01], primeiro)[0];
    expect(primeiro).toEqual([0.51, 0.50]);
    expect(segundo).toEqual([0.50, 0.51]);
    expect(primeiro.map((valor, indice) => centavos(valor) + centavos(segundo[indice]))).toEqual([101, 101]);
  });

  it("não lança valor de itens ignorados e permite total integrado menor que a nota", () => {
    expect(ratearItensPorDuplicatas([0, 1], [1, 1])).toEqual([[0, 0], [0.50, 0.50]]);
    expect(ratearItensPorDuplicatas([], [1, 1], [0.50, 0.50])).toEqual([]);
  });

  it("mantém os títulos legados mesmo quando já excedem um alvo em um centavo", () => {
    expect(ratearItensPorDuplicatas([0.01], [0.01, 0.01], [0.02, 0])).toEqual([[0, 0.01]]);
  });

  it("preserva totais em centavos para diversos tamanhos, pesos e valores pequenos", () => {
    for (let quantidade = 1; quantidade <= 16; quantidade++) {
      const itens = Array.from({ length: quantidade }, (_, indice) => ((indice * 17 + quantidade) % 101) / 100);
      const pesos = [0.01, 0.02, 1.03, 37.38];
      const matriz = ratearItensPorDuplicatas(itens, pesos);
      expect(matriz.map(linha => linha.reduce((soma, valor) => soma + centavos(valor), 0))).toEqual(itens.map(centavos));
      const total = itens.reduce((soma, valor) => soma + centavos(valor), 0) / 100;
      expect(pesos.map((_, indice) => matriz.reduce((soma, linha) => soma + centavos(linha[indice]), 0))).toEqual(ratearValor(total, pesos).map(centavos));
      expect(matriz.flat().every(valor => valor >= 0)).toBe(true);
    }
  });

  it("recusa valores negativos, inválidos ou sem parcelas", () => {
    expect(() => ratearItensPorDuplicatas([-1], [1])).toThrow();
    expect(() => ratearItensPorDuplicatas([NaN], [1])).toThrow();
    expect(() => ratearItensPorDuplicatas([1], [])).toThrow();
  });
});
