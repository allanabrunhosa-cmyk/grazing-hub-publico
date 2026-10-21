// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import { NavegacaoMovel } from "@/components/layout/navegacao-movel";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { recursoDaRota, type Permissoes } from "@/lib/permissoes/catalogo";
import { findModuleByPathname } from "@/lib/modules";

vi.mock("next/navigation", () => ({ usePathname: () => "/porcoes" }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} onClick={e => e.preventDefault()} /> }));
afterEach(cleanup);

function menu(permissoes: Permissoes = {}, admin = true, movel = false) {
  render(<ProvedorAcesso acesso={{ admin, permissoes, excecoes: {} }}>{movel ? <NavegacaoMovel /> : <ConteudoMenuLateral />}</ProvedorAcesso>);
}

it("mostra Tabela de Porções imediatamente após Insumos e identifica o módulo", () => {
  menu();
  const links = screen.getAllByRole("link");
  const indice = links.indexOf(screen.getByRole("link", { name: "Insumos" }));
  const porcoes = screen.getByRole("link", { name: "Tabela de Porções" });
  expect(links[indice + 1]).toBe(porcoes);
  expect(porcoes.getAttribute("href")).toBe("/porcoes");
  expect(porcoes.getAttribute("aria-current")).toBe("page");
  expect(findModuleByPathname("/porcoes").slug).toBe("suprimentos");
  expect(recursoDaRota("/porcoes")).toBe("suprimentos.porcoes");
});

it("respeita a permissão própria, inclusive acesso exclusivo à tabela", () => {
  menu({ insumos: ["visualizar"] }, false);
  expect(screen.queryByRole("link", { name: "Tabela de Porções" })).toBeNull();
  cleanup();
  menu({ "suprimentos.porcoes": ["visualizar"] }, false);
  expect(screen.getByRole("link", { name: "Tabela de Porções" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Insumos" })).toBeNull();
});

it("reutiliza a entrada no menu móvel e fecha ao navegar", async () => {
  const u = userEvent.setup(); menu({}, true, true);
  await u.click(screen.getByRole("button", { name: "Abrir navegação" }));
  await u.click(screen.getByRole("link", { name: "Tabela de Porções" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
