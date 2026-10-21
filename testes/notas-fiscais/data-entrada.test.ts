import { describe, expect, it } from "vitest";
import { diaEntradaEstoque, validarDataEntradaEstoque } from "@/lib/notas-fiscais/data-entrada";

describe("data efetiva da entrada de nota no estoque", () => {
  const agora = new Date("2026-09-12T01:00:00Z");
  it("usa o dia de Brasília na virada UTC", () => {
    expect(diaEntradaEstoque(agora)).toBe("2026-09-11");
    expect(validarDataEntradaEstoque("2026-09-12", agora)).toHaveProperty("erro");
  });
  it.each([undefined, null, "", "11/09/2026", "2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-09-11T12:00:00Z"])("rejeita data ausente ou inválida: %s", valor => {
    expect(validarDataEntradaEstoque(valor, agora)).toHaveProperty("erro");
  });
  it.each(["2026-09-11", "2026-09-01", "2024-02-29"])("preserva o dia informado: %s", valor => {
    expect(validarDataEntradaEstoque(valor, agora)).toEqual({ data: new Date(`${valor}T15:00:00Z`) });
  });
});
