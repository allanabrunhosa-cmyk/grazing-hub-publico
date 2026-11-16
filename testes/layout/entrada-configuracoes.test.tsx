// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso, useAcesso } from "@/components/layout/acesso-contexto";
import { ModuleSwitcher } from "@/components/layout/module-switcher";
import { NavegacaoMovel } from "@/components/layout/navegacao-movel";
import Configuracoes from "@/app/(protegido)/configuracoes/page";

const estado = vi.hoisted(() => ({ pathname: "/financeiro/fiscal/configuracoes", pode: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => estado.pathname, redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} onClick={evento => evento.preventDefault()} /> }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: estado.pode }));
afterEach(() => { cleanup(); vi.resetAllMocks(); estado.pathname = "/financeiro/fiscal/configuracoes"; });

type Acesso = ComponentProps<typeof ProvedorAcesso>["acesso"];
const cenarios: { nome: string; acesso: Acesso; destino?: string }[] = [
  { nome: "administrador", acesso: { admin: true, permissoes: {}, excecoes: {} }, destino: "/configuracoes/usuarios" },
  { nome: "usuários e emissor fiscal", acesso: { admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"], "configuracoes.brasilnfe": ["visualizar"] }, excecoes: {} }, destino: "/configuracoes/usuarios" },
  { nome: "somente usuários", acesso: { admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"] }, excecoes: {} }, destino: "/configuracoes/usuarios" },
  { nome: "somente integração fiscal", acesso: { admin: false, permissoes: { "configuracoes.brasilnfe": ["visualizar"] }, excecoes: {} }, destino: "/configuracoes/integracoes" },
  { nome: "somente MCP", acesso: { admin: false, permissoes: { "configuracoes.mcp": ["visualizar"] }, excecoes: {} }, destino: "/configuracoes/integracoes" },
  { nome: "exceção concede usuários", acesso: { admin: false, permissoes: {}, excecoes: { "configuracoes.usuarios": { visualizar: true } } }, destino: "/configuracoes/usuarios" },
  { nome: "exceção retira usuários e preserva integração", acesso: { admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"], "configuracoes.brasilnfe": ["visualizar"] }, excecoes: { "configuracoes.usuarios": { visualizar: false } } }, destino: "/configuracoes/integracoes" },
  { nome: "sem permissão", acesso: { admin: false, permissoes: {}, excecoes: {} } },
  { nome: "exceção retira o único acesso", acesso: { admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"] }, excecoes: { "configuracoes.usuarios": { visualizar: false } } } },
];

it.each(cenarios)("Configurações usa sua entrada e respeita permissões: $nome", async ({ acesso, destino }) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <ProvedorAcesso acesso={acesso}>{children}</ProvedorAcesso>;
  const { result } = renderHook(() => useAcesso(), { wrapper });
  expect(result.current.entradaModulo("configuracoes")).toBe(destino ? "/configuracoes" : undefined);
  estado.pode.mockImplementation(async (recurso: string) => result.current.pode(recurso));
  await expect(Configuracoes()).rejects.toThrow("REDIRECT:" + (destino ?? "/sem-acesso"));
});

it.each([false, true])("seletor separa Configurações do Fiscal, móvel=%s", async movel => {
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>{movel ? <NavegacaoMovel /> : <ModuleSwitcher />}</ProvedorAcesso>);
  if (movel) await usuario.click(screen.getByRole("button", { name: "Abrir navegação" }));
  await usuario.click(screen.getByRole("button", { name: "Trocar módulo: Financeiro" }));
  const menu = within(await screen.findByRole("menu"));
  expect(menu.getByRole("menuitem", { name: /^Configurações/ }).getAttribute("href")).toBe("/configuracoes");
  expect(menu.getByRole("menuitem", { name: /^Financeiro/ }).getAttribute("href")).toBe("/financeiro");
});

it("preserva a entrada fiscal de quem só pode configurar o emissor", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <ProvedorAcesso acesso={{ admin: false, permissoes: { "configuracoes.brasilnfe": ["visualizar"] }, excecoes: {} }}>{children}</ProvedorAcesso>;
  const { result } = renderHook(() => useAcesso(), { wrapper });
  expect(result.current.entradaModulo("financeiro")).toBe("/financeiro/fiscal/configuracoes");
  expect(result.current.pode("configuracoes.usuarios")).toBe(false);
});
