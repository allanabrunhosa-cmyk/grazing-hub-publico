// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import { NavegacaoMovel } from "@/components/layout/navegacao-movel";
import { CATALOGO, recursoDaRota, validarPermissoes } from "@/lib/permissoes/catalogo";
import { APP_MODULES, findModuleByPathname } from "@/lib/modules";

vi.mock("next/navigation", () => ({ usePathname: () => "/crm" }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it("Vendas & CRM oferece Atendimento em nova aba com a permissão histórica preservada", () => {
  vi.stubEnv("ATENDIMENTO_HABILITADO", "false");
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { crm: ["visualizar"] }, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  const link = screen.getByRole("link", { name: /Atendimento.*abre em nova aba/ });
  expect(link.getAttribute("href")).toBe("https://atendimento.grazinghub.com.br");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.queryByText("Nenhum item disponível ainda.")).toBeNull();
  expect(process.env.ATENDIMENTO_HABILITADO).toBe("false");
});

it("remove o módulo separado e conserva o acesso ao Atendimento dentro de Vendas & CRM", async () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { crm: ["visualizar"], rh: ["visualizar"] }, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  await userEvent.setup().click(screen.getByRole("button", { name: "Trocar módulo: Vendas & CRM" }));
  const vendas = await screen.findByRole("menuitem", { name: /Vendas & CRM/ });
  expect(vendas.getAttribute("href")).toBe("/vendas");
  expect(within(vendas).queryByText("Em breve")).toBeNull();
  expect(screen.queryByRole("menuitem", { name: /^CRM/ })).toBeNull();
  expect(within(screen.getByRole("menuitem", { name: /RH/ })).getByText("Em breve")).toBeDefined();
});

it("não oferece o atalho a quem não pode acessar Atendimento", () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: {}, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  expect(screen.queryByRole("link", { name: /Atendimento/ })).toBeNull();
});

it.each([false, true])("inclui Dashboard primeiro e mantém Atendimento logo após Gestor de pedidos, móvel=%s", async movel => {
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>{movel ? <NavegacaoMovel /> : <ConteudoMenuLateral />}</ProvedorAcesso>);
  if (movel) await userEvent.setup().click(screen.getByRole("button", { name: "Abrir navegação" }));
  const links = within(screen.getByRole("navigation", { name: "Navegação de Vendas & CRM" })).getAllByRole("link");
  expect(links.slice(0, 4).map(link => link.textContent?.trim())).toEqual(["Dashboard", "Gestor de pedidos", "Atendimento (abre em nova aba)", "Clientes"]);
});

it("preserva as concessões históricas sem criar outro módulo ou ampliar acesso aos clientes", () => {
  expect(APP_MODULES.some(m => m.slug === "crm")).toBe(false);
  expect(findModuleByPathname("/crm").slug).toBe("vendas");
  expect(findModuleByPathname("/vendas/atendimento").name).toBe("Vendas & CRM");
  expect(CATALOGO.some(m => m.id === "crm")).toBe(false);
  expect(CATALOGO.find(m => m.id === "vendas")?.secoes.find(s => s.id === "crm")?.nome).toBe("Atendimento");
  expect(recursoDaRota("/crm")).toBe("crm");
  expect(recursoDaRota("/vendas/atendimento")).toBe("crm");
  expect(validarPermissoes({ crm: ["visualizar"] })).toEqual({ crm: ["visualizar"] });
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { crm: ["visualizar"] }, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  expect(screen.queryByRole("link", { name: "Clientes" })).toBeNull();
});
