// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { NavegacaoMovel } from "@/components/layout/navegacao-movel";
import { SeletorAparencia } from "@/components/layout/seletor-aparencia";

const { definirTema } = vi.hoisted(() => ({ definirTema: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/inventario/contagem" }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} onClick={(evento) => evento.preventDefault()} /> }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: definirTema }) }));
afterEach(cleanup);

it("oferece os atalhos internos no celular e fecha ao escolher uma página", async () => {
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><NavegacaoMovel /></ProvedorAcesso>);
  await usuario.click(screen.getByRole("button", { name: "Abrir navegação" }));
  expect(screen.getByRole("dialog", { name: "Navegação do sistema" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Estoque" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Contagem de estoque" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Compras" }).getAttribute("href")).toBe("/compras");
  expect(screen.getByRole("link", { name: "Manifesto de Notas" }).getAttribute("href")).toBe("/notas-fiscais");
  await usuario.click(screen.getByRole("link", { name: "Fornecedores" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("permite fechar a navegação pelo teclado e devolve o foco ao botão", async () => {
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><NavegacaoMovel /></ProvedorAcesso>);
  const botao = screen.getByRole("button", { name: "Abrir navegação" });
  await usuario.click(botao);
  await usuario.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(botao));
});

it("encaminha a escolha de aparência ao provedor de temas", async () => {
  const usuario = userEvent.setup();
  render(<SeletorAparencia />);
  screen.getByRole("button", { name: "Alterar aparência" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await usuario.click(await screen.findByRole("menuitem", { name: "Escuro" }));
  expect(definirTema).toHaveBeenCalledWith("dark");
});
