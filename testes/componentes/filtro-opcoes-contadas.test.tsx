// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";

afterEach(cleanup);

it("mantém contagens acessíveis, seleção exclusiva e opções vazias acionáveis", async () => {
  const alterar = vi.fn();
  const opcoes = [{ valor: "todos", nome: "Todos", quantidade: 1234 }, { valor: "vazio", nome: "Inativos", quantidade: 0 }];
  const { rerender } = render(<FiltroOpcoesContadas nome="Filtrar cadastros" valor="todos" opcoes={opcoes} onValueChange={alterar} />);
  const grupo = within(screen.getByRole("group", { name: "Filtrar cadastros" }));
  expect(grupo.getByRole("button", { name: "Todos (1.234)", pressed: true })).toBeTruthy();
  const vazio = grupo.getByRole("button", { name: "Inativos (0)", pressed: false });
  expect(vazio).toHaveProperty("disabled", false);
  await userEvent.click(vazio);
  expect(alterar).toHaveBeenCalledExactlyOnceWith("vazio");
  rerender(<FiltroOpcoesContadas nome="Filtrar cadastros" valor="vazio" opcoes={opcoes} onValueChange={alterar} />);
  expect(grupo.getByRole("button", { name: "Inativos (0)", pressed: true })).toBeTruthy();
  expect(grupo.getByRole("button", { name: "Todos (1.234)", pressed: false })).toBeTruthy();
});

it("preserva o bloqueio durante uma operação pendente", async () => {
  const alterar = vi.fn();
  render(<FiltroOpcoesContadas nome="Situação" valor="todos" disabled opcoes={[{ valor: "todos", nome: "Todos", quantidade: 0 }]} onValueChange={alterar} />);
  const botao = screen.getByRole("button", { name: "Todos (0)" });
  expect(botao).toHaveProperty("disabled", true);
  await userEvent.click(botao);
  expect(alterar).not.toHaveBeenCalled();
});
