import { describe, expect, it } from "vitest";
import { calcularSaldosMovimentacoes, movimentacaoNoPeriodo } from "@/lib/estoque/extrato";
import type { TipoMovimentacaoEstoque } from "@/generated/prisma/client";

const movimento = (id: string, tipo: TipoMovimentacaoEstoque, quantidade: number, localId = "principal", insumoId = "arroz") =>
  ({ id, tipo, quantidade, localId, insumoId, createdAt: `2026-09-${id.padStart(2, "0")}T12:00:00.000Z` });
const posicao = (quantidadeAtual: number, localId = "principal", insumoId = "arroz") => ({ quantidadeAtual, localId, insumoId });

describe("saldo após movimentação de estoque", () => {
  it("preserva o saldo inicial implícito e não depende da ordem recebida", () => {
    const dados = [movimento("1", "ENTRADA_COMPRA", 10), movimento("2", "SAIDA_CONSUMO", 2)];
    expect(calcularSaldosMovimentacoes(dados, [posicao(13)]).map(m => [m.id, m.saldo])).toEqual([["2", 13], ["1", 15]]);
    expect(dados[0].id).toBe("1");
  });
  it("separa insumos e locais", () => {
    const dados = [movimento("1", "ENTRADA_COMPRA", 10), movimento("2", "AJUSTE_ENTRADA", 3, "cozinha"), movimento("3", "ENTRADA_COMPRA", 7, "principal", "sal")];
    expect(calcularSaldosMovimentacoes(dados, [posicao(10), posicao(3, "cozinha"), posicao(7, "principal", "sal")]).map(m => m.saldo)).toEqual([7, 3, 10]);
  });
  it("inclui perdas, consumo, ajustes e estornos, com milésimos e saldo negativo", () => {
    const dados = [movimento("1", "ENTRADA_COMPRA", 0.3), movimento("2", "SAIDA_PERDA", 0.1), movimento("3", "AJUSTE_ENTRADA", 0.1), movimento("4", "AJUSTE_SAIDA", 0.4)];
    expect(calcularSaldosMovimentacoes(dados, [posicao(-0.1)]).map(m => m.saldo)).toEqual([-0.1, 0.3, 0.2, 0.3]);
  });
  it("desempata datas iguais pelo ID e não inventa saldo quando falta a posição", () => {
    const a = movimento("1", "ENTRADA_COMPRA", 2);
    const b = { ...movimento("2", "SAIDA_CONSUMO", 1), createdAt: a.createdAt };
    expect(calcularSaldosMovimentacoes([a, b], [posicao(1)]).map(m => m.saldo)).toEqual([1, 2]);
    expect(calcularSaldosMovimentacoes([a], [])[0].saldo).toBeNull();
  });
  it("filtrar uma saída antiga mantém o saldo calculado com os movimentos posteriores", () => {
    const extrato = calcularSaldosMovimentacoes([movimento("1", "ENTRADA_COMPRA", 10), movimento("2", "SAIDA_PERDA", 2), movimento("3", "AJUSTE_ENTRADA", 5)], [posicao(13)]);
    expect(extrato.filter(m => movimentacaoNoPeriodo(m.createdAt, "2026-09-02", "2026-09-02"))[0].saldo).toBe(8);
  });
  it("aplica datas inclusivas em Brasília, limites abertos e intervalo invertido", () => {
    expect(movimentacaoNoPeriodo("2026-09-03T02:59:59.999Z", "2026-09-02", "2026-09-02")).toBe(true);
    expect(movimentacaoNoPeriodo("2026-09-03T03:00:00.000Z", "2026-09-02", "2026-09-02")).toBe(false);
    expect(movimentacaoNoPeriodo("2026-09-03T12:00:00.000Z", "2026-09-02", "")).toBe(true);
    expect(movimentacaoNoPeriodo("2026-09-03T12:00:00.000Z", "", "2026-09-04")).toBe(true);
    expect(movimentacaoNoPeriodo("2026-09-03T12:00:00.000Z", "2026-09-04", "2026-09-02")).toBe(false);
  });
});
