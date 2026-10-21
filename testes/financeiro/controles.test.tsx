// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { CategoriaFinanceiraCombobox } from "@/components/categoria-financeira-combobox";
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("permite escolher mês, ano e voltar às datas personalizadas", async () => {
  const alterar = vi.fn();
  const usuario = userEvent.setup();
  render(<FiltroPeriodo de="2026-09-01" ate="2026-09-10" aoAlterar={alterar} />);
  screen.getByRole("combobox", { name: "Filtro" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await usuario.click(screen.getByRole("option", { name: "Mês completo" }));
  expect(alterar).toHaveBeenLastCalledWith({ de: "2026-09-01", ate: "2026-09-30" });
  fireEvent.change(screen.getByLabelText("Mês de referência"), { target: { value: "2024-02" } });
  expect(alterar).toHaveBeenLastCalledWith({ de: "2024-02-01", ate: "2024-02-29" });
  screen.getByRole("combobox", { name: "Filtro" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await usuario.click(screen.getByRole("option", { name: "Ano completo" }));
  expect(alterar).toHaveBeenLastCalledWith({ de: "2026-01-01", ate: "2026-12-31" });
  fireEvent.change(screen.getByLabelText("Ano de referência"), { target: { value: "2025" } });
  expect(alterar).toHaveBeenLastCalledWith({ de: "2025-01-01", ate: "2025-12-31" });
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2025-02-01" } });
  expect(screen.getByLabelText("De")).toBeDefined();
  expect(screen.getByLabelText("até")).toBeDefined();
});

it("busca categorias por palavra sem perder os grupos e permite selecionar o resultado", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const selecionar = vi.fn();
  const usuario = userEvent.setup();
  const categoriaLonga = "Alimentação > Insumos de cozinha > Queijos especiais para eventos corporativos";
  render(<CategoriaFinanceiraCombobox value="" onChange={selecionar} ariaLabel="Categoria" categorias={[
      { id: "vendas", nome: "Venda direta", grupo: "RECEITA_BRUTA" },
      { id: "aluguel", nome: "Aluguel", grupo: "DESPESAS_OPERACIONAIS" },
      { id: "queijos", nome: categoriaLonga, grupo: "CMV" },
    ]} />);
  const busca = screen.getByRole("combobox", { name: "Categoria" });
  await usuario.click(busca);
  expect(screen.getByText("Despesas Operacionais")).toBeDefined();
  expect(screen.getByText("Entrada")).toBeDefined();
  expect(screen.getAllByText("Saída").length).toBeGreaterThan(0);
  expect(screen.queryByRole("option", { name: "Despesas Operacionais" })).toBeNull();
  expect(document.querySelector('[data-slot="combobox-group"][data-natureza-financeira="entrada"]')).toBeTruthy();
  expect(document.querySelector('[data-slot="combobox-group"][data-natureza-financeira="saida"]')).toBeTruthy();
  await usuario.type(busca, "queijos especiais");
  expect(screen.queryByRole("option", { name: "Venda direta" })).toBeNull();
  expect(screen.queryByRole("option", { name: "Aluguel" })).toBeNull();
  const opcaoLonga = screen.getByRole("option", { name: categoriaLonga });
  expect(opcaoLonga.getAttribute("title")).toBe(categoriaLonga);
  await usuario.click(opcaoLonga);
  expect(selecionar).toHaveBeenCalledWith("queijos");
});


it("oferece os filtros rápidos, mês fechado e limpa as datas no componente controlado", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 11, 12));
  function Exemplo() {
    const [periodo, definirPeriodo] = useState({ de: "", ate: "" });
    return <FiltroPeriodo {...periodo} aoAlterar={definirPeriodo} />;
  }
  render(<Exemplo />);
  const usuario = userEvent.setup();
  expect(screen.queryByText("Atalho")).toBeNull();
  screen.getByRole("combobox", { name: "Filtro" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await usuario.click(screen.getByRole("option", { name: "Últimos 7 dias" }));
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-09-05");
  expect((screen.getByLabelText("até") as HTMLInputElement).value).toBe("2026-09-11");
  screen.getByRole("combobox", { name: "Filtro" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await usuario.click(screen.getByRole("option", { name: "Mês fechado" }));
  screen.getByRole("combobox", { name: "Mês fechado" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await usuario.click(screen.getByRole("option", { name: "Agosto de 2026" }));
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-08-01");
  expect((screen.getByLabelText("até") as HTMLInputElement).value).toBe("2026-08-31");
  await usuario.click(screen.getByRole("button", { name: "Limpar datas" }));
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("até") as HTMLInputElement).value).toBe("");
  expect(screen.queryByRole("combobox", { name: "Mês fechado" })).toBeNull();
});


it("não aplica uma data enquanto o usuário ainda digita o mês", () => {
  const alterar = vi.fn();
  render(<FiltroPeriodo de="2026-10-01" ate="2026-10-05" aoAlterar={alterar} />);
  const inicio = screen.getByLabelText("De") as HTMLInputElement;
  fireEvent.change(inicio, { target: { value: "2026-01-01" } });
  expect(alterar).not.toHaveBeenCalled();
  expect(inicio.value).toBe("2026-01-01");
  fireEvent.change(inicio, { target: { value: "2026-09-01" } });
  fireEvent.blur(inicio);
  expect(alterar).toHaveBeenCalledExactlyOnceWith({ de: "2026-09-01", ate: "2026-10-05" });
});

it.each(["De", "até"])("não confunde o zero intermediário em %s com limpar a data", (nome) => {
  const alterar = vi.fn();
  render(<FiltroPeriodo de="2026-10-01" ate="2026-10-05" aoAlterar={alterar} />);
  const campo = screen.getByLabelText(nome) as HTMLInputElement;
  let incompleta = true;
  Object.defineProperty(campo, "validity", { configurable: true, get: () => ({ badInput: incompleta, valid: !incompleta }) });
  fireEvent.change(campo, { target: { value: "" } });
  fireEvent.blur(campo);
  expect(alterar).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("Complete a data");
  incompleta = false;
  fireEvent.change(campo, { target: { value: "2026-09-01" } });
  fireEvent.keyDown(campo, { key: "Enter" });
  expect(alterar).toHaveBeenCalledExactlyOnceWith(nome === "De" ? { de: "2026-09-01", ate: "2026-10-05" } : { de: "2026-10-01", ate: "2026-09-01" });
});

it("limpa um limite somente após concluir a edição e mantém Limpar datas explícito", () => {
  const alterar = vi.fn();
  render(<FiltroPeriodo de="2026-10-01" ate="2026-10-05" aoAlterar={alterar} />);
  const inicio = screen.getByLabelText("De") as HTMLInputElement;
  fireEvent.change(inicio, { target: { value: "" } });
  expect(alterar).not.toHaveBeenCalled();
  fireEvent.blur(inicio);
  expect(alterar).toHaveBeenLastCalledWith({ de: "", ate: "2026-10-05" });
  fireEvent.click(screen.getByRole("button", { name: "Limpar datas" }));
  expect(alterar).toHaveBeenLastCalledWith({ de: "", ate: "" });
});


it("substitui o rascunho quando o período externo muda, inclusive ao voltar ao valor anterior", () => {
  const alterar = vi.fn();
  const { rerender } = render(<FiltroPeriodo de="2026-10-01" ate="2026-10-05" aoAlterar={alterar} />);
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-01-01" } });
  rerender(<FiltroPeriodo de="2026-09-01" ate="2026-09-30" aoAlterar={alterar} />);
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-09-01");
  rerender(<FiltroPeriodo de="2026-10-01" ate="2026-10-05" aoAlterar={alterar} />);
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-10-01");
  expect(alterar).not.toHaveBeenCalled();
});
