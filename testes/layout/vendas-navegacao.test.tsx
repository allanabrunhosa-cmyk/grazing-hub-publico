// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import { NavegacaoMovel } from "@/components/layout/navegacao-movel";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { recursoDaRota, type Permissoes } from "@/lib/permissoes/catalogo";

const sim = vi.hoisted(() => ({ rota: "/vendas/pedidos" }));
vi.mock("next/navigation", () => ({ usePathname: () => sim.rota }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} onClick={e => e.preventDefault()} /> }));
afterEach(() => { cleanup(); sim.rota = "/vendas/pedidos"; });
function menu(permissoes: Permissoes = {}, admin = true, movel = false) {
  render(<ProvedorAcesso acesso={{ admin, permissoes, excecoes: {} }}>{movel ? <NavegacaoMovel /> : <ConteudoMenuLateral />}</ProvedorAcesso>);
}
it("mostra o Dashboard primeiro, com página ativa, sem alterar os atalhos existentes", () => {
  sim.rota = "/vendas/bi"; menu();
  const links = screen.getAllByRole("link");
  expect(links[0].textContent).toBe("Dashboard");
  expect(links[0].getAttribute("href")).toBe("/vendas/bi");
  expect(links[0].getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Gestor de pedidos" }).getAttribute("aria-current")).toBeNull();
});
it("oculta o Dashboard sem permissão própria e permite um usuário com somente Dashboard", () => {
  menu({ vendas: ["visualizar"], "vendas.pedidos": ["visualizar"] }, false);
  expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  cleanup(); menu({ "vendas.bi": ["visualizar"] }, false);
  expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/vendas/bi");
  expect(screen.queryByRole("link", { name: "Gestor de pedidos" })).toBeNull();
});
it("reúne Produtos e Complementos em Cardápio, com destinos e indicação da página ativa", async () => {
  const u = userEvent.setup(); menu();
  expect(screen.queryByRole("link", { name: "Produtos" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Complementos" })).toBeNull();
  await u.click(screen.getByRole("button", { name: "Expandir Cardápio" }));
  expect(screen.getByRole("link", { name: "Produtos" }).getAttribute("href")).toBe("/vendas/produtos");
  expect(screen.getByRole("link", { name: "Complementos" }).getAttribute("href")).toBe("/vendas/catalogo");
  cleanup(); sim.rota = "/vendas/catalogo"; menu();
  expect(screen.getByRole("button", { name: "Recolher Cardápio" }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("link", { name: "Complementos" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Produtos" }).getAttribute("aria-current")).toBeNull();
});
it("Cardápio funciona com somente um filho permitido e desaparece sem acesso", () => {
  sim.rota = "/vendas/catalogo"; menu({ "vendas.catalogo": ["visualizar"] }, false);
  expect(screen.getByRole("link", { name: "Complementos" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Produtos" })).toBeNull();
  expect(screen.queryByText("Nenhum item disponível ainda.")).toBeNull();
  cleanup(); menu({}, false);
  expect(screen.queryByRole("button", { name: /Cardápio/ })).toBeNull();
});
it("recolhe Cardápio por Escape e funciona também no menu móvel", async () => {
  const u = userEvent.setup(); sim.rota = "/vendas/produtos"; menu();
  screen.getByRole("link", { name: "Produtos" }).focus(); await u.keyboard("{Escape}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Expandir Cardápio" }));
  await u.keyboard("{Enter}"); expect(screen.getByRole("link", { name: "Produtos" })).toBeTruthy();
  cleanup(); menu({}, true, true);
  await u.click(screen.getByRole("button", { name: "Abrir navegação" }));
  await u.click(screen.getByRole("link", { name: "Complementos" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("agrupa as três configurações, começa recolhido e mantém os destinos", async () => {
  const u = userEvent.setup(); menu();
  expect(screen.queryByRole("link", { name: "Formas de pagamento" })).toBeNull();
  await u.click(screen.getByRole("button", { name: "Expandir Configurações" }));
  expect(screen.getByRole("link", { name: "Formas de pagamento" }).getAttribute("href")).toBe("/vendas/formas-pagamento");
  expect(screen.getByRole("link", { name: "Horários de entrega" }).getAttribute("href")).toBe("/vendas/horarios");
  expect(screen.getByRole("link", { name: "Entregas" }).getAttribute("href")).toBe("/vendas/area-entrega");
  expect(screen.getByRole("button", { name: "Recolher Configurações" }).getAttribute("aria-expanded")).toBe("true");
});
it("não expõe Fiscal em Vendas e preserva a permissão legada", () => {
  sim.rota = "/vendas/pedidos"; menu({ "vendas.fiscal": ["visualizar"] }, false);
  expect(screen.queryByRole("button", { name: /Fiscal/ })).toBeNull();
  expect(recursoDaRota("/vendas/fiscal/vinculos")).toBe("vendas.fiscal");
  expect(recursoDaRota("/financeiro/fiscal/vinculos")).toBe("vendas.fiscal");
  expect(recursoDaRota("/financeiro/fiscal/grupos")).toBe("vendas.fiscal");
});
it("filtra filhos, funciona com somente um acesso e oculta grupos vazios", () => {
  sim.rota = "/vendas/horarios"; menu({ "vendas.horarios": ["visualizar"] }, false);
  expect(screen.getByRole("link", { name: "Horários de entrega" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("link", { name: "Formas de pagamento" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Entregas" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Fiscal/ })).toBeNull();
  expect(screen.queryByText("Nenhum item disponível ainda.")).toBeNull();
});
it("recolhe pelo teclado a partir do filho e retorna o foco ao expansor", async () => {
  const u = userEvent.setup(); sim.rota = "/vendas/horarios"; menu();
  screen.getByRole("link", { name: "Horários de entrega" }).focus(); await u.keyboard("{Escape}");
  const expansor = screen.getByRole("button", { name: "Expandir Configurações" });
  expect(document.activeElement).toBe(expansor);
  expect(expansor.getAttribute("aria-expanded")).toBe("false");
  await u.keyboard("{Enter}"); expect(screen.getByRole("link", { name: "Horários de entrega" })).toBeTruthy();
});
it("não apresenta o agrupamento Fiscal na navegação móvel de Vendas", async () => {
  const u = userEvent.setup(); sim.rota = "/vendas/pedidos"; menu({}, true, true);
  await u.click(screen.getByRole("button", { name: "Abrir navegação" }));
  expect(screen.queryByRole("button", { name: /Fiscal/ })).toBeNull();
  await u.click(screen.getByRole("link", { name: "Clientes" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
