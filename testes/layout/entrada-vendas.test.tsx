// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso, useAcesso } from "@/components/layout/acesso-contexto";
import { ModuleSwitcher } from "@/components/layout/module-switcher";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import { NavegacaoMovel } from "@/components/layout/navegacao-movel";
import { CAMINHO_PEDIDOS, HOST_PEDIDOS } from "@/lib/hosts";

const estado = vi.hoisted(() => ({ pathname: "/vendas" }));
vi.mock("next/navigation", () => ({ usePathname: () => estado.pathname }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} onClick={evento => evento.preventDefault()} /> }));
afterEach(() => { cleanup(); estado.pathname = "/vendas"; });

type Acesso = ComponentProps<typeof ProvedorAcesso>["acesso"];
const cenarios: { nome: string; acesso: Acesso; entrada: boolean; pedidos: boolean }[] = [
  { nome: "administrador", acesso: { admin: true, permissoes: {}, excecoes: {} }, entrada: true, pedidos: true },
  { nome: "somente Dashboard", acesso: { admin: false, permissoes: { "vendas.bi": ["visualizar"] }, excecoes: {} }, entrada: true, pedidos: false },
  { nome: "somente Pedidos", acesso: { admin: false, permissoes: { "vendas.pedidos": ["visualizar"] }, excecoes: {} }, entrada: true, pedidos: true },
  { nome: "somente Clientes, sem Pedidos", acesso: { admin: false, permissoes: { "vendas.clientes": ["visualizar"] }, excecoes: {} }, entrada: true, pedidos: false },
  { nome: "somente Horários, sem Pedidos", acesso: { admin: false, permissoes: { "vendas.horarios": ["visualizar"] }, excecoes: {} }, entrada: true, pedidos: false },
  { nome: "negação total", acesso: { admin: false, permissoes: {}, excecoes: {} }, entrada: false, pedidos: false },
  { nome: "exceção individual concede Pedidos", acesso: { admin: false, permissoes: {}, excecoes: { "vendas.pedidos": { visualizar: true } } }, entrada: true, pedidos: true },
  { nome: "exceção retira Pedidos e preserva Horários", acesso: { admin: false, permissoes: { "vendas.pedidos": ["visualizar"], "vendas.horarios": ["visualizar"] }, excecoes: { "vendas.pedidos": { visualizar: false } } }, entrada: true, pedidos: false },
  { nome: "exceção retira o único acesso", acesso: { admin: false, permissoes: { "vendas.pedidos": ["visualizar"] }, excecoes: { "vendas.pedidos": { visualizar: false } } }, entrada: false, pedidos: false },
];

it.each(cenarios)("entrada de Vendas permanece no HUB: $nome", async ({ acesso, entrada, pedidos }) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <ProvedorAcesso acesso={acesso}>{children}</ProvedorAcesso>;
  const { result } = renderHook(() => useAcesso(), { wrapper });
  expect(result.current.entradaModulo("vendas")).toBe(entrada ? "/vendas" : undefined);
  expect(result.current.pode("vendas.pedidos")).toBe(pedidos);
  expect(result.current.pode("vendas")).toBe(acesso.admin);

  render(<ModuleSwitcher />, { wrapper });
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Trocar módulo: Vendas & CRM" }));
  const vendas = within(await screen.findByRole("menu")).queryByRole("menuitem", { name: /^Vendas/ });
  if (!entrada) {
    expect(vendas).toBeNull();
  } else {
    expect(vendas).not.toBeNull();
    expect(vendas?.getAttribute("href")).toBe("/vendas");
    expect(vendas?.getAttribute("target")).toBeNull();
  }
});

it.each([false, true])("menu de Vendas mantém Gestor e Atendimento como atalhos externos, móvel=%s", async movel => {
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>{movel ? <NavegacaoMovel /> : <ConteudoMenuLateral />}</ProvedorAcesso>);
  if (movel) await usuario.click(screen.getByRole("button", { name: "Abrir navegação" }));
  const menu = within(screen.getByRole("navigation", { name: "Navegação de Vendas & CRM" }));
  const bi = menu.getByRole("link", { name: "Dashboard" });
  expect(menu.getAllByRole("link")[0]).toBe(bi);
  expect(bi.getAttribute("href")).toBe("/vendas/bi");
  expect(bi.getAttribute("target")).toBeNull();
  const gestor = menu.getByRole("link", { name: "Gestor de pedidos" });
  expect(gestor.getAttribute("href")).toBe(`https://${HOST_PEDIDOS}${CAMINHO_PEDIDOS}`);
  expect(gestor.getAttribute("target")).toBe("_blank");
  expect(gestor.getAttribute("rel")).toBe("noreferrer");
  expect(gestor.querySelector("svg.lucide-arrow-up-right")?.getAttribute("aria-hidden")).toBe("true");
  expect(menu.queryByRole("link", { name: "Produção de pedidos" })).toBeNull();
  expect(menu.queryByRole("link", { name: "Calendário de pedidos" })).toBeNull();
  expect(menu.queryByRole("button", { name: /Fiscal/ })).toBeNull();
  await usuario.click(menu.getByRole("button", { name: "Expandir Configurações" }));
  await usuario.click(menu.getByRole("button", { name: "Expandir Cardápio" }));

  const destinos = [
    ["Clientes", "/vendas/clientes"],
    ["Produtos", "/vendas/produtos"],
    ["Complementos", "/vendas/catalogo"],
    ["Formas de pagamento", "/vendas/formas-pagamento"],
    ["Horários de entrega", "/vendas/horarios"],
    ["Entregas", "/vendas/area-entrega"],
  ];
  for (const [nome, destino] of destinos) {
    const link = menu.getByRole("link", { name: nome });
    expect(link.getAttribute("href")).toBe(destino);
    expect(link.getAttribute("target")).toBeNull();
  }
  const atendimento = menu.getByRole("link", { name: /Atendimento.*abre em nova aba/ });
  expect(atendimento.getAttribute("href")).toBe("https://atendimento.grazinghub.com.br");
  expect(atendimento.getAttribute("rel")).toBe("noopener noreferrer");
  expect(menu.getAllByRole("link").filter(link => link.getAttribute("target") === "_blank")).toEqual([gestor, atendimento]);
  if (movel) {
    await usuario.click(gestor);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }
});
