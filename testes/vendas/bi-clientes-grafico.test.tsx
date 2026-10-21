// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GraficoClientes } from "@/components/vendas/bi/bi-clientes-grafico";
import type { DistribuicaoClienteBi } from "@/lib/vendas/bi-types";

afterEach(cleanup);
const base: DistribuicaoClienteBi[] = [
  { tipo: "PF", pedidos: 2, faturamento: 90, ticket: 45 },
  { tipo: "PJ", pedidos: 1, faturamento: 10, ticket: 10 },
  { tipo: "nao-informado", pedidos: 1, faturamento: 0, ticket: 0 },
];
describe("comparação de tipos no Dashboard", () => {
  it("apresenta valores e percentuais textuais da métrica selecionada, inclusive tipo ausente", () => {
    const { rerender } = render(<GraficoClientes distribuicao={base} metrica="pedidos" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Distribuição de pedidos");
    expect(screen.getByLabelText("Valores por tipo de pessoa: pedidos").textContent).toContain("50%");
    expect(screen.getByText("Sem classificação")).toBeTruthy();
    rerender(<GraficoClientes distribuicao={base} metrica="faturamento" />);
    expect(screen.getByLabelText("Valores por tipo de pessoa: faturamento").textContent).toContain("90%");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Distribuição de faturamento");
  });
  it("não desenha fatias para valores incompletos, negativos, zero total ou permissão ausente", () => {
    const { rerender } = render(<GraficoClientes distribuicao={null} metrica="pedidos" />);
    expect(screen.getByText("Consulta restrita à permissão de clientes.")).toBeTruthy();
    for (const valor of [null, -10, 0]) {
      rerender(<GraficoClientes distribuicao={[{ tipo: "PF", pedidos: 1, faturamento: valor, ticket: valor }]} metrica="faturamento" />);
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.queryByText("100%")).toBeNull();
      if (valor === null) expect(screen.getByText(/Faturamento não apurado em parte/)).toBeTruthy();
      if (valor === -10) expect(screen.getByText(/Há valores negativos/)).toBeTruthy();
      if (valor === 0) expect(screen.getByText("Faturamento total zero nesta seleção.")).toBeTruthy();
    }
  });
  it("renderiza um círculo completo quando só um tipo tem movimento", () => {
    render(<GraficoClientes distribuicao={[{ tipo: "PJ", pedidos: 1, faturamento: 10, ticket: 10 }]} metrica="pedidos" />);
    expect(screen.getByRole("img").querySelector("circle")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
  });
});
