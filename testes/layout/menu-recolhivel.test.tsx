// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";

vi.mock("next/navigation", () => ({ usePathname: () => "/inventario/contagem" }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
function montar(id = "ficticio") { return render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><Sidebar usuarioId={id} /></ProvedorAcesso>); }

it("recolhe por teclado, conserva nomes acessíveis e restaura a preferência do usuário", async () => {
  const user = userEvent.setup();
  const tela = montar();
  screen.getByRole("button", { name: "Recolher menu lateral" }).focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Expandir menu lateral" }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("link", { name: "Insumos" })).toBeDefined();
  expect(localStorage.getItem("grazing:menu-lateral:ficticio")).toBe("recolhido");
  tela.unmount(); montar();
  expect(screen.getByRole("button", { name: "Expandir menu lateral" })).toBeDefined();
});

it("abre o submenu em portal, conserva a rota ativa e devolve o foco com Escape", async () => {
  localStorage.setItem("grazing:menu-lateral:ficticio", "recolhido");
  const user = userEvent.setup(); montar();
  const trigger = screen.getByRole("button", { name: "Abrir Estoque" });
  await user.click(trigger);
  expect(screen.getByRole("link", { name: "Contagem de estoque" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Compras" }).closest("aside")).toBeNull();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("link", { name: "Compras" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("não aplica a preferência de outra pessoa e funciona com armazenamento bloqueado", async () => {
  localStorage.setItem("grazing:menu-lateral:outra", "recolhido");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
  const user = userEvent.setup(); montar("sem-storage");
  await user.click(screen.getByRole("button", { name: "Recolher menu lateral" }));
  expect(screen.getByRole("button", { name: "Expandir menu lateral" })).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Expandir menu lateral" }));
  expect(screen.getByRole("button", { name: "Recolher menu lateral" })).toBeDefined();
});

it("exibe o nome completo do link recolhido ao receber foco", async () => {
  localStorage.setItem("grazing:menu-lateral:ficticio", "recolhido");
  const user = userEvent.setup(); montar();
  const link = screen.getByRole("link", { name: "Tabela de Porções" });
  for (let i = 0; i < 30 && document.activeElement !== link; i++) await user.tab();
  expect(document.activeElement).toBe(link);
  await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')?.textContent).toBe("Tabela de Porções"));
  expect(link.textContent).toBe("Tabela de Porções");
});

it("exibe o nome do módulo ao passar o mouse sobre o ícone", async () => {
  localStorage.setItem("grazing:menu-lateral:ficticio", "recolhido");
  const user = userEvent.setup(); montar();
  await user.hover(screen.getByRole("link", { name: "Insumos" }));
  await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')?.textContent).toBe("Insumos"));
});
