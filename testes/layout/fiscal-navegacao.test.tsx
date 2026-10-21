// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso, useAcesso } from "@/components/layout/acesso-contexto";
import { ConteudoMenuLateral, Sidebar } from "@/components/layout/sidebar";
import { NavegacaoMovel } from "@/components/layout/navegacao-movel";
import { CATALOGO, permissaoEfetiva, recursoDaRota, validarPermissoes } from "@/lib/permissoes/catalogo";

const estado = vi.hoisted(() => ({ pathname: "/financeiro/fiscal" }));
vi.mock("next/navigation", () => ({ usePathname: () => estado.pathname }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} onClick={evento => evento.preventDefault()} /> }));

type Acesso = ComponentProps<typeof ProvedorAcesso>["acesso"];
const acessoAdministrador: Acesso = { admin: true, permissoes: {}, excecoes: {} };
const acessoCadastro: Acesso = { admin: false, permissoes: { "vendas.fiscal": ["visualizar", "editar"] }, excecoes: {} };
afterEach(() => { cleanup(); localStorage.clear(); estado.pathname = "/financeiro/fiscal"; });
function montar(acesso = acessoAdministrador, movel = false) {
  render(<ProvedorAcesso acesso={acesso}>{movel ? <NavegacaoMovel /> : <ConteudoMenuLateral />}</ProvedorAcesso>);
}

it("Fiscal encerra Financeiro imediatamente após Bancos, com os destinos corretos", () => {
  montar();
  const nav = within(screen.getByRole("navigation", { name: "Navegação de Financeiro" }));
  expect(nav.getAllByRole("link").slice(-6).map(link => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Bancos", "/financeiro/bancario"],
    ["Fiscal", "/financeiro/fiscal"],
    ["Visão geral", "/financeiro/fiscal"],
    ["Grupos fiscais", "/financeiro/fiscal/grupos"],
    ["Vínculos fiscais", "/financeiro/fiscal/vinculos"],
    ["Configurações", "/financeiro/fiscal/configuracoes"],
  ]);
  expect(nav.getByRole("link", { name: "Visão geral" }).getAttribute("aria-current")).toBe("page");
});

it("a permissão histórica oferece cadastros em Financeiro sem conceder o painel ou Vendas", () => {
  estado.pathname = "/financeiro/fiscal/grupos";
  const wrapper = ({ children }: { children: React.ReactNode }) => <ProvedorAcesso acesso={acessoCadastro}>{children}</ProvedorAcesso>;
  const { result } = renderHook(() => useAcesso(), { wrapper });
  expect(result.current.entradaModulo("financeiro")).toBe("/financeiro/fiscal/grupos");
  expect(result.current.entradaModulo("vendas")).toBeUndefined();
  expect(result.current.podeRota("/financeiro/fiscal")).toBe(false);
  montar(acessoCadastro);
  expect(screen.getByRole("link", { name: "Fiscal" }).getAttribute("href")).toBe("/financeiro/fiscal/grupos");
  expect(screen.getByRole("link", { name: "Grupos fiscais" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Vínculos fiscais" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "Visão geral" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Configurações" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Homologação individual" })).toBeNull();
  expect(screen.queryByText("Nenhum item disponível ainda.")).toBeNull();
});

it("painel usa um recurso separado, negado por padrão e sem elevar acesso aos cadastros", () => {
  const financeiro = CATALOGO.find(modulo => modulo.id === "financeiro")!;
  expect(financeiro.secoes.some(secao => secao.id === "vendas.fiscal")).toBe(true);
  expect(CATALOGO.find(modulo => modulo.id === "vendas")!.secoes.some(secao => secao.id === "vendas.fiscal")).toBe(false);
  expect(permissaoEfetiva(acessoCadastro.permissoes, {}, "financeiro.fiscal.painel", "visualizar")).toBe(false);
  montar({ admin: false, permissoes: { "financeiro.fiscal.painel": ["visualizar"] }, excecoes: {} });
  expect(screen.getByRole("link", { name: "Visão geral" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Configurações" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "Grupos fiscais" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Vínculos fiscais" })).toBeNull();
});

it("preserva recursos e concessões de atividades existentes ao adicionar Fiscal", () => {
  const atividades = CATALOGO.find(modulo => modulo.id === "configuracoes")!.secoes.find(secao => secao.id === "configuracoes.usuarios.atividades");
  expect(atividades?.acoes).toEqual(["visualizar"]);
  const permissoes = validarPermissoes({ "configuracoes.usuarios.atividades": ["visualizar"], "vendas.fiscal": ["visualizar"] });
  expect(permissaoEfetiva(permissoes, {}, "configuracoes.usuarios.atividades", "visualizar")).toBe(true);
  expect(permissaoEfetiva(permissoes, {}, "financeiro.fiscal.painel", "visualizar")).toBe(false);
});

it("respeita exceções individuais e oculta Fiscal quando o último acesso é retirado", () => {
  montar({ ...acessoCadastro, excecoes: { "vendas.fiscal": { visualizar: false } } });
  expect(screen.queryByRole("link", { name: "Fiscal" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Fiscal/ })).toBeNull();
  cleanup();
  montar({ admin: false, permissoes: {}, excecoes: { "financeiro.fiscal.painel": { visualizar: true } } });
  expect(screen.getByRole("link", { name: "Visão geral" })).toBeDefined();
});

it.each(["grupos", "vinculos"])("subrota %s conserva a permissão histórica e a indicação ativa", segmento => {
  estado.pathname = `/financeiro/fiscal/${segmento}/ficticio`;
  expect(recursoDaRota(estado.pathname)).toBe("vendas.fiscal");
  expect(recursoDaRota(`/vendas/fiscal/${segmento}/ficticio`)).toBe("vendas.fiscal");
  montar(acessoCadastro);
  expect(screen.getByRole("link", { name: segmento === "grupos" ? "Grupos fiscais" : "Vínculos fiscais" }).getAttribute("aria-current")).toBe("page");
});
it.each([["empresa", "Empresa fiscal"], ["cobertura", "Classificação fiscal"]])("%s preserva a permissão da rota sem aparecer no menu", (segmento, nome) => {
  estado.pathname = `/financeiro/fiscal/${segmento}`;
  expect(recursoDaRota(estado.pathname)).toBe("vendas.fiscal");
  montar(acessoCadastro);
  expect(screen.queryByRole("link", { name: nome })).toBeNull();
});
it("numeração conserva a guarda do painel financeiro e indica sua navegação ativa", () => {
  estado.pathname = "/financeiro/fiscal/configuracoes";
  expect(recursoDaRota(estado.pathname)).toBe("financeiro.fiscal.painel");
  montar({ admin: false, permissoes: { "financeiro.fiscal.painel": ["visualizar"] }, excecoes: {} });
  expect(screen.getByRole("link", { name: "Configurações" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("link", { name: "Grupos fiscais" })).toBeNull();
});

it("menu móvel oferece os mesmos cadastros e fecha ao escolher o vínculo", async () => {
  const usuario = userEvent.setup(); estado.pathname = "/financeiro/fiscal/grupos";
  montar(acessoCadastro, true);
  await usuario.click(screen.getByRole("button", { name: "Abrir navegação" }));
  expect(screen.queryByRole("link", { name: "Visão geral" })).toBeNull();
  const link = screen.getByRole("link", { name: "Vínculos fiscais" });
  expect(link.getAttribute("href")).toBe("/financeiro/fiscal/vinculos");
  await usuario.click(link);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("lateral recolhida preserva ACL, destino permitido e foco por teclado", async () => {
  const usuario = userEvent.setup(); estado.pathname = "/financeiro/fiscal/vinculos";
  localStorage.setItem("grazing:menu-lateral:ficticio-fiscal", "recolhido");
  render(<ProvedorAcesso acesso={acessoCadastro}><Sidebar usuarioId="ficticio-fiscal" /></ProvedorAcesso>);
  const gatilho = screen.getByRole("button", { name: "Abrir Fiscal" });
  await usuario.click(gatilho);
  expect(screen.getByRole("link", { name: "Abrir Fiscal" }).getAttribute("href")).toBe("/financeiro/fiscal/grupos");
  expect(screen.getByRole("link", { name: "Vínculos fiscais" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("link", { name: "Visão geral" })).toBeNull();
  await usuario.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("link", { name: "Vínculos fiscais" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(gatilho));
});
