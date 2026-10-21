import { describe, expect, it } from "vitest";
import { calcularSnapshotEntrada, validarItensEntrada, planejarCorrecaoEntrada, diferencasEntrada, type EntradaSnapshot } from "@/lib/inventario/entrada-avulsa-historico";
const catalogo = [{ id: "produto", nome: "Produto fictício", unidade: "KG" as const }];
const locais = [{ id: "local", nome: "Local fictício" }];
const base = { tipo: "OUTRO_MOTIVO" as const, data: "2026-10-10", observacao: "Ajuste fictício", fornecedorId: null, fornecedorNome: null, frete: 0, desconto: 0, custosAdicionais: [] };
describe("deltas e precisão das entradas", () => {
  it("converte frações decimais sem ruído e guarda unidade comercial", () => {
    const s = calcularSnapshotEntrada(base, [{ insumoId: "produto", localId: "local", quantidade: 0.1, fatorConversao: 0.1, valorProdutos: 10, unidadeEntrada: "caixa" }], catalogo, locais);
    expect(s.itens[0].quantidadeEstoque).toBe("0.01"); expect(s.itens[0].unidadeEntrada).toBe("caixa");
  });
  it("limita caracteres/precisão/duplicatas no servidor", () => {
    const i = { insumoId: "produto", localId: "local", quantidade: 1, valorProdutos: 0 };
    expect(() => validarItensEntrada([{ ...i, quantidade: 1.0000001 }])).toThrow("seis casas");
    expect(() => validarItensEntrada([{ ...i, quantidade: 0.000001, fatorConversao: 0.000001 }])).toThrow("nove casas");
    expect(() => validarItensEntrada([i, i])).toThrow("duas vezes");
    expect(() => validarItensEntrada([{ ...i, unidadeEntrada: "x".repeat(31) }])).toThrow("30 caracteres");
    expect(() => validarItensEntrada([{ ...i, valorProdutos: -1 }])).toThrow("valores válidos");
  });
  it("a redução usa só a diferença, sem retirar quantidade já consumida", () => {
    const antes = calcularSnapshotEntrada(base, [{ insumoId: "produto", localId: "local", quantidade: 10, valorProdutos: 100 }], catalogo, locais);
    const depois = calcularSnapshotEntrada(base, [{ insumoId: "produto", localId: "local", quantidade: 8, valorProdutos: 100 }], catalogo, locais);
    const plano = planejarCorrecaoEntrada(antes, depois); expect(plano).toHaveLength(1); expect(plano[0].quantidade.toString()).toBe("-2"); expect(plano[0].valor.toString()).toBe("0");
    expect(diferencasEntrada(antes, depois)).toContainEqual({ campo: "Item 1 · Quantidade", anterior: "10", novo: "8" });
  });
  it("bloqueia conversão cadastral antiga e não transforma observação em movimento", () => {
    const antes = calcularSnapshotEntrada(base, [{ insumoId: "produto", localId: "local", quantidade: 1, valorProdutos: 0 }], catalogo, locais);
    const depois: EntradaSnapshot = { ...antes, observacao: "Nova observação" };
    expect(planejarCorrecaoEntrada(antes, depois)).toEqual([]); expect(diferencasEntrada(antes, depois)).toHaveLength(1);
    expect(() => planejarCorrecaoEntrada(antes, { ...antes, itens: [{ ...antes.itens[0], unidade: "G" }] })).toThrow("unidade");
  });
});
