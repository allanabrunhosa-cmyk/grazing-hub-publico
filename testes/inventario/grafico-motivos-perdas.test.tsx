// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ResumoPerdas } from "@/app/(protegido)/inventario/perdas/resumo-perdas";
import type { PerdaRow } from "@/app/(protegido)/inventario/types";

afterEach(cleanup);
const linhas: PerdaRow[] = Array.from({ length: 8 }, (_, indice) => ({
  id: `perda-${indice}`, categoriaPerdaId: `categoria-${indice}`, categoriaNome: `Motivo ${indice}`,
  motivo: "OUTRO", motivoPersonalizado: null, insumoNome: "Insumo fictício", localNome: "Estoque",
  data: "2026-10-20T12:00:00Z", quantidade: 1, unidade: "KG", valorEstimado: 80 - indice * 5,
  observacao: null, responsavelNome: null,
}));

function estiloDaLegenda(nome: string) {
  const item = within(screen.getByRole("list", { name: "Valores por motivo de perda" })).getByText(nome).closest("li")!;
  const preenchimento = item.querySelector("circle")!.getAttribute("fill")!;
  const padrao = document.getElementById(preenchimento.slice(5, -1))!;
  return { preenchimento, cor: padrao.querySelector("rect")!.getAttribute("fill"), desenho: padrao.innerHTML };
}

it("distingue categorias personalizadas que compartilham OUTRO e conserva a legenda das fatias", () => {
  render(<ResumoPerdas linhas={linhas.slice(0, 5)} />);
  const estilos = linhas.slice(0, 5).map(linha => estiloDaLegenda(linha.categoriaNome!));
  expect(new Set(estilos.map(estilo => estilo.cor)).size).toBe(5);
  const fatias = screen.getByRole("img").querySelectorAll("path[fill]");
  expect([...fatias].map(fatia => fatia.getAttribute("fill"))).toEqual(estilos.map(estilo => estilo.preenchimento));
  expect(screen.getByTestId("total-perdas").textContent).toContain("350,00");
});

it("mantém a identidade visual ao inverter valores e filtrar o período", () => {
  const { rerender } = render(<ResumoPerdas linhas={linhas} referenciaCores={linhas} />);
  const anterior = estiloDaLegenda("Motivo 3");
  rerender(<ResumoPerdas linhas={[{ ...linhas[3], valorEstimado: 500 }, linhas[1]]} referenciaCores={[...linhas].reverse()} />);
  expect(estiloDaLegenda("Motivo 3")).toEqual(anterior);
});

it("acrescenta texturas distintas quando há mais motivos que cores", () => {
  render(<ResumoPerdas linhas={linhas} />);
  const estilos = linhas.map(linha => estiloDaLegenda(linha.categoriaNome!));
  expect(new Set(estilos.map(estilo => estilo.desenho)).size).toBe(8);
  expect(estilos[0].cor).toBe(estilos[5].cor);
  expect(estilos[0].desenho).not.toBe(estilos[5].desenho);
});

it("exibe círculo completo para um motivo e mantém o estado sem valor", () => {
  const { rerender } = render(<ResumoPerdas linhas={[linhas[0]]} />);
  expect(screen.getByRole("img").querySelector("circle[r='49']")!.getAttribute("fill")).toMatch(/^url/);
  rerender(<ResumoPerdas linhas={linhas.map(linha => ({ ...linha, valorEstimado: 0 }))} />);
  expect(screen.getByRole("img", { name: /sem valores positivos/ })).toBeTruthy();
  expect(screen.getByText("Sem valor positivo para calcular as fatias.")).toBeTruthy();
  rerender(<ResumoPerdas linhas={[]} />);
  expect(screen.getByText("Sem perdas para mostrar.")).toBeTruthy();
});
