// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { compararCusto } from "@/lib/notas-fiscais/comparar-custo";
import { ComparativoCusto } from "@/app/(protegido)/notas-fiscais/comparativo-custo";
afterEach(cleanup);
describe("Conferência do custo na unidade de estoque", () => {
  it("compara uma caixa convertida em seis quilos com o custo por quilo", () => {
    expect(compararCusto(10, 6, 72)).toMatchObject({ precoCompra: 12, custoAtual: 10 });
    render(<ComparativoCusto custoMedio={10} quantidade={6} valorTotal={72} unidade="kg" />);
    expect(screen.getByText("Subiu +20,00%")).toBeTruthy();
    expect(screen.getByText(/12,00 por kg/)).toBeTruthy();
  });
  it("informa queda sem depender apenas de cor e não oferece troca de custo", () => {
    render(<ComparativoCusto custoMedio={10} quantidade={6} valorTotal={48} unidade="kg" />);
    expect(screen.getByText("Abaixou −20,00%")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("trata igualdade, ausência de histórico, quantidade inválida e compra gratuita", () => {
    expect(compararCusto(10, 1, 10).percentual).toBe(0);
    expect(compararCusto(0, 1, 10).percentual).toBeNull();
    expect(compararCusto(10, 0, 10).precoCompra).toBeNull();
    expect(compararCusto(10, NaN, 10).percentual).toBeNull();
    expect(compararCusto(10, 1, -1).percentual).toBeNull();
    expect(compararCusto(10, 1, 0).percentual).toBe(-100);
    render(<ComparativoCusto custoMedio={0} quantidade={1} valorTotal={10} unidade="un" />);
    expect(screen.getByText("Sem custo anterior para comparar.")).toBeTruthy();
  });
});
