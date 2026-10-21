// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Rh from "@/app/(protegido)/rh/page";
import Crm from "@/app/(protegido)/crm/page";
import Atendimento from "@/app/(protegido)/vendas/atendimento/page";
import Patrimonio from "@/app/(protegido)/patrimonio/page";
import Producao from "@/app/(protegido)/producao/page";
import SemAcesso from "@/app/(protegido)/sem-acesso/page";
import Configuracoes from "@/app/(protegido)/configuracoes/page";
import Contas from "@/app/(protegido)/financeiro/contas/page";
import Lancamentos from "@/app/(protegido)/financeiro/lancamentos/page";
import Vendas from "@/app/(protegido)/vendas/page";
const mocks = vi.hoisted(() => ({ exigir: vi.fn(async () => ({})), pode: vi.fn(), dedicado: false, pedidos: false, sessao: { admin: false, permissoes: {}, excecoes: {} } }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: mocks.exigir, podeAcessar: mocks.pode }));
vi.mock("@/lib/session", () => ({ getSession: async () => mocks.sessao }));
vi.mock("@/lib/contexto-interface", () => ({ identidadeDaInterface: async () => mocks.pedidos ? "pedidos" : mocks.dedicado ? "etiquetas" : "hub" }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.dedicado = false; mocks.pedidos = false; });
it.each([["rh", Rh], ["patrimonio", Patrimonio]] as const)("mantém %s como entrada protegida, sem inventar operações", async (recurso, Pagina) => {
  render(await Pagina());
  expect(mocks.exigir).toHaveBeenCalledWith(recurso);
  expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  expect(screen.getByText("Módulo em construção.")).toBeDefined();
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("rota antiga mantém a guarda e redireciona para Atendimento em Vendas", async () => {
  await expect(Crm()).rejects.toThrow("REDIRECT:/vendas/atendimento");
  expect(mocks.exigir).toHaveBeenCalledWith("crm");
});
it("Atendimento mantém a guarda existente e abre em nova aba", async () => {
  render(await Atendimento());
  expect(mocks.exigir).toHaveBeenCalledWith("crm");
  const link = screen.getByRole("link", { name: /Atendimento.*abre em nova aba/ });
  expect(link.getAttribute("href")).toBe("https://atendimento.grazinghub.com.br");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.queryByText("Módulo em construção.")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("Produção leva ao módulo único de Validades após a guarda", async () => {
  render(await Producao());
  expect(mocks.exigir).toHaveBeenCalledWith("producao");
  expect(screen.getByRole("link", { name: "Controle de validades" }).getAttribute("href")).toBe("/producao/etiquetas");
});
it.each([false, true])("acesso negado não sugere recursos proibidos, dedicado=%s", async dedicado => {
  mocks.dedicado = dedicado; render(await SemAcesso());
  expect(screen.getByRole("heading", { name: "Acesso não permitido" })).toBeDefined();
  expect(screen.getAllByRole("link").map(l => l.getAttribute("href"))).toEqual([dedicado ? "/" : "/perfil"]);
});
it("redireciona configurações pela permissão, sem abrir central para não autorizado", async () => {
  mocks.pode.mockResolvedValue(false);
  await expect(Configuracoes()).rejects.toThrow("REDIRECT:/sem-acesso");
  mocks.pode.mockImplementation(async (recurso: string) => recurso === "configuracoes.loja");
  await expect(Configuracoes()).rejects.toThrow("REDIRECT:/configuracoes/empresa");
});
it("acesso negado de Pedidos não oferece módulos proibidos no subdomínio", async () => {
  mocks.pedidos = true; render(await SemAcesso());
  expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/"]);
  expect(screen.getByRole("link", { name: "Voltar ao gestor de pedidos" })).toBeDefined();
});
it("entrada Vendas permanece no HUB e oferece o gestor somente por clique", async () => {
  mocks.pode.mockImplementation(async (recurso: string) => recurso === "vendas.pedidos");
  render(await Vendas());
  expect(mocks.exigir).toHaveBeenCalledWith("vendas.pedidos");
  expect(screen.getByRole("heading", { name: "Vendas & CRM" })).toBeDefined();
  const gestor = screen.getByRole("link", { name: "Abrir gestor de pedidos" });
  expect(gestor.getAttribute("href")).toBe("https://pedidos.grazinghub.com.br/vendas/pedidos");
  expect(gestor.getAttribute("target")).toBe("_blank");
  expect(gestor.querySelector("svg")).not.toBeNull();
});
it("entrada Vendas preserva o módulo para quem acessa horários sem o gestor", async () => {
  mocks.pode.mockImplementation(async (recurso: string) => ["vendas.pedidos.producao", "vendas.horarios"].includes(recurso));
  render(await Vendas());
  expect(mocks.exigir).toHaveBeenCalledWith("vendas.horarios");
  expect(screen.getByRole("heading", { name: "Vendas & CRM" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "Abrir gestor de pedidos" })).toBeNull();
  expect(screen.queryByText("Produção de pedidos")).toBeNull();
  expect(screen.queryByText("Calendário de pedidos")).toBeNull();
});
it("somente Atendimento entra no módulo unificado sem ganhar acesso ao Gestor", async () => {
  mocks.pode.mockImplementation(async (recurso: string) => recurso === "crm");
  render(await Vendas());
  expect(mocks.exigir).toHaveBeenCalledWith("crm");
  expect(screen.getByRole("link", { name: /Atendimento.*abre em nova aba/ })).toBeDefined();
  expect(screen.queryByRole("link", { name: "Abrir gestor de pedidos" })).toBeNull();
});
it("entrada Vendas conserva a guarda do módulo quando nenhum submódulo é autorizado", async () => {
  mocks.pode.mockResolvedValue(false);
  mocks.exigir.mockRejectedValueOnce(new Error("REDIRECT:/sem-acesso"));
  await expect(Vendas()).rejects.toThrow("REDIRECT:/sem-acesso");
  expect(mocks.exigir).toHaveBeenCalledWith("vendas");
});
it.each([[Contas, "financeiro.baixas"], [Lancamentos, "financeiro.movimentacoes"]] as const)("preserva guarda da rota financeira legada", async (Pagina, recurso) => {
  await expect(Pagina()).rejects.toThrow("REDIRECT:/financeiro/movimentacoes");
  expect(mocks.exigir).toHaveBeenCalledWith(recurso);
});
