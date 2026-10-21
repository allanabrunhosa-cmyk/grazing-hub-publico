import { describe, expect, it } from "vitest";
import { calcularSaldosMovimentacoes } from "@/lib/estoque/extrato";
import { montarTrechoMovimentacoes } from "@/lib/estoque/detalhe-movimentacoes";
import { formatarQuantidadeEstoque } from "@/lib/estoque/quantidade";

describe("frações no histórico de estoque", () => {
  const movimentos = [
    { id: "entrada", insumoId: "insumo", localId: "local", createdAt: "2026-09-16T10:00:00Z", tipo: "ENTRADA_COMPRA" as const, quantidade: 1 },
    { id: "perda", insumoId: "insumo", localId: "local", createdAt: "2026-09-16T11:00:00Z", tipo: "SAIDA_PERDA" as const, quantidade: 0.0875 },
    { id: "pequena", insumoId: "insumo", localId: "local", createdAt: "2026-09-16T12:00:00Z", tipo: "SAIDA_PERDA" as const, quantidade: 0.00000001 },
  ];
  it("reconstrói saldos sem converter perdas em milésimos", () => {
    expect(calcularSaldosMovimentacoes(movimentos, [{ insumoId: "insumo", localId: "local", quantidadeAtual: 0.91249999 }]).map(l => l.saldo))
      .toEqual([0.91249999, 0.9125, 1]);
    const trecho = montarTrechoMovimentacoes(movimentos, 0.91249999);
    expect(trecho.movimentos.map(l => l.saldo)).toEqual([1, 0.9125, 0.91249999]);
    expect(trecho.saldoAnteriorAoTrecho).toBe(0);
  });
  it("não apresenta uma fração positiva como zero", () => {
    expect(formatarQuantidadeEstoque(0.0875)).toBe("0,0875");
    expect(formatarQuantidadeEstoque(0.00000001)).toBe("0,00000001");
    expect(formatarQuantidadeEstoque(Number.MIN_VALUE)).not.toBe("0");
  });
});
