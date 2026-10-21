// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerdasTable } from "@/app/(protegido)/inventario/perdas/perdas-table";
import type { PerdaExcluidaRow, PerdaRow } from "@/app/(protegido)/inventario/types";

vi.mock("@/app/(protegido)/inventario/perdas/actions", () => ({ excluirPerdaAction: vi.fn() }));
afterEach(cleanup);
const perda: PerdaRow = { id: "1", data: "2026-09-11T15:00:00Z", insumoNome: "Queijo", localNome: "Estoque", motivo: "QUEBRA", motivoPersonalizado: null, quantidade: 1, unidade: "KG", valorEstimado: 120, observacao: null, responsavelNome: "Ana" };
const excluida: PerdaExcluidaRow = { ...perda, id: "3", insumoNome: "Perda excluída", valorEstimado: 900, excluidaEm: "2026-09-12T03:00:00Z", motivoExclusao: "Registro duplicado", responsavelExclusaoNome: "Allan", quantidadeEstornada: 1, unidadeEstornada: "KG" };

it("filtra resumo/lista e limpa datas sem somar exclusões ao total", async () => {
  render(<PerdasTable linhas={[perda, { ...perda, id: "2", data: "2026-08-31T15:00:00Z", valorEstimado: 80 }]} historico={[excluida]} acaoRegistrar={<button>Registrar perda</button>} />);
  expect(screen.getByTestId("total-perdas").textContent).toContain("120,00");
  expect(screen.getByLabelText("De").getAttribute("value")).toBe("2026-09-01");
  expect(screen.getByLabelText("até").getAttribute("value")).toBe("2026-09-18");
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-01" } });
  fireEvent.blur(screen.getByLabelText("De"));
  fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-09-11" } });
  fireEvent.blur(screen.getByLabelText("até"));
  expect(screen.getByTestId("total-perdas").textContent).toContain("120,00");
  expect(screen.getByRole("tab", { name: "Perdas (1)" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Exclusões (0)" })).toBeTruthy();
  expect(screen.getByRole("img", { name: /Gráfico em pizza/ })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Limpar datas" }));
  expect(screen.getByTestId("total-perdas").textContent).toContain("200,00");
  await userEvent.click(screen.getByRole("tab", { name: "Exclusões (1)" }));
  expect(screen.getByText("Registro duplicado")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Registrar perda" })).toBeTruthy();
});

it("oferece os atalhos de período do Manifesto e não expõe exclusões a usuário comum", async () => {
  render(<PerdasTable linhas={[{ ...perda, valorEstimado: 0 }]} />);
  expect(screen.queryByRole("tab", { name: /Exclusões/ })).toBeNull();
  expect(screen.getByRole("img", { name: /sem valores positivos/ })).toBeTruthy();
  await userEvent.click(screen.getByRole("combobox", { name: "Filtro" }));
  expect(await screen.findByRole("option", { name: "Últimos 30 dias" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Mês fechado" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Ano completo" })).toBeTruthy();
});

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-18T15:00:00Z")); });
afterEach(() => vi.useRealTimers());
