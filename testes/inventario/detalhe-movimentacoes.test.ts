import { describe, expect, it } from "vitest";
import { montarTrechoMovimentacoes } from "@/lib/estoque/detalhe-movimentacoes";

const movimento = (numero: number, tipo: "ENTRADA_COMPRA" | "SAIDA_CONSUMO", quantidade: number) => ({
  id: String(numero).padStart(2, "0"),
  createdAt: `2026-09-${String(numero).padStart(2, "0")}T12:00:00.000Z`,
  tipo,
  quantidade,
});

describe("trecho de movimentações do insumo", () => {
  it("apresenta da mais antiga à recente e termina no saldo de referência", () => {
    const trecho = montarTrechoMovimentacoes([
      movimento(3, "ENTRADA_COMPRA", 5),
      movimento(1, "ENTRADA_COMPRA", 10),
      movimento(2, "SAIDA_CONSUMO", 2),
    ], 13);
    expect(trecho.movimentos.map((item) => [item.id, item.saldo])).toEqual([["01", 10], ["02", 8], ["03", 13]]);
    expect(trecho.saldoAnteriorAoTrecho).toBe(0);
    expect(trecho.temMais).toBe(false);
  });

  it("limita o retorno e preserva o saldo anterior ao trecho", () => {
    const movimentos = Array.from({ length: 51 }, (_, indice) => ({
      id: String(indice + 1).padStart(3, "0"),
      createdAt: new Date(Date.UTC(2026, 0, indice + 1, 12)).toISOString(),
      tipo: "ENTRADA_COMPRA" as const,
      quantidade: 0.1,
    }));
    const trecho = montarTrechoMovimentacoes(movimentos, 5.1, 50);
    expect(trecho.movimentos).toHaveLength(50);
    expect(trecho.movimentos.at(-1)?.saldo).toBe(5.1);
    expect(trecho.saldoAnteriorAoTrecho).toBe(0.1);
    expect(trecho.temMais).toBe(true);
  });
});
