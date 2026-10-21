// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import IntegracoesPage from "@/app/(protegido)/configuracoes/integracoes/page";
import ConfiguracoesPage from "@/app/(protegido)/configuracoes/page";
import BrasilNfePage from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/page";
import { configuracaoBrasilNfeFicticia } from "../fiscal-saida/brasilnfe-interface-dados";
import { preRequisitosBrasilNfeVazios } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";

const { recursos, guarda, redirecionar, carregar, preRequisitos, controle } = vi.hoisted(() => ({ recursos: new Set<string>(), guarda: vi.fn(async (): Promise<void> => { throw new Error("SEM_ACESSO"); }), carregar: vi.fn(), preRequisitos: vi.fn(), controle: vi.fn(), redirecionar: vi.fn((rota: string) => { throw new Error(`REDIRECT:${rota}`); }) }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: vi.fn(async (recurso: string, acao = "visualizar") => recursos.has(acao === "visualizar" ? recurso : `${recurso}:${acao}`)), exigirPermissao: guarda }));
vi.mock("@/app/(protegido)/configuracoes/integracoes/brasilnfe-actions", () => ({ obterConfiguracaoBrasilNfeAction: carregar, salvarConfiguracaoBrasilNfeAction: vi.fn(), validarConexaoBrasilNfeAction: vi.fn(), obterPreRequisitosBrasilNfeAction: preRequisitos, registrarEvidenciaPainelBrasilNfeAction: vi.fn(), verificarPreRequisitosBrasilNfeAction: vi.fn(), obterHabilitacaoEmissaoBrasilNfeAction: controle, configurarHabilitacaoEmissaoBrasilNfeAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/configuracoes/integracoes/brasilnfe", redirect: redirecionar }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));
beforeEach(() => { vi.clearAllMocks(); recursos.clear(); preRequisitos.mockResolvedValue({ ok: true, dados: preRequisitosBrasilNfeVazios(1) }); controle.mockResolvedValue({ ok: false, erro: "Controle indisponível na fixture sintética." }); });
afterEach(cleanup);

it.each(["configuracoes.mcp", "configuracoes.brasilnfe"])("preserva o acesso de %s à entrada Integrações", async recurso => {
  recursos.add(recurso);
  render(await IntegracoesPage());
  expect(Boolean(screen.queryByRole("link", { name: "Gerenciar MCP" }))).toBe(recurso === "configuracoes.mcp");
  expect(Boolean(screen.queryByRole("link", { name: "Configurar Brasil NFe" }))).toBe(recurso === "configuracoes.brasilnfe");
});

it("exibe ambos os cartões somente quando há acesso aos dois recursos", async () => {
  recursos.add("configuracoes.mcp"); recursos.add("configuracoes.brasilnfe");
  render(await IntegracoesPage());
  expect(screen.getByRole("link", { name: "Gerenciar MCP" }).getAttribute("href")).toBe("/configuracoes/integracoes/mcp");
  expect(screen.getByRole("link", { name: "Configurar Brasil NFe" }).getAttribute("href")).toBe("/configuracoes/integracoes/brasilnfe");
});

it("aciona a guarda central quando nenhum recurso de integração está autorizado", async () => {
  await expect(IntegracoesPage()).rejects.toThrow("SEM_ACESSO");
  expect(guarda).toHaveBeenCalledWith("configuracoes.mcp");
});

it("mantém a navegação Integrações disponível com permissão fiscal independente do MCP", () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { "configuracoes.brasilnfe": ["visualizar"] }, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  expect(screen.getByRole("link", { name: "Integrações" }).getAttribute("href")).toBe("/configuracoes/integracoes");
});

it("nega o item de navegação quando ambas as permissões estão ausentes", () => {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: {}, excecoes: {} }}><ConteudoMenuLateral /></ProvedorAcesso>);
  expect(screen.queryByRole("link", { name: "Integrações" })).toBeNull();
});

it("encaminha a entrada Configurações à integração para perfil somente fiscal", async () => {
  recursos.add("configuracoes.brasilnfe");
  await expect(ConfiguracoesPage()).rejects.toThrow("REDIRECT:/configuracoes/integracoes/brasilnfe");
});

it("protege a página fiscal antes de carregar qualquer configuração", async () => {
  await expect(BrasilNfePage()).rejects.toThrow("SEM_ACESSO");
  expect(guarda).toHaveBeenCalledWith("configuracoes.brasilnfe");
  expect(carregar).not.toHaveBeenCalled();
  expect(preRequisitos).not.toHaveBeenCalled();
  expect(controle).not.toHaveBeenCalled();
});

it("renderiza a página fiscal em modo de leitura quando edição não foi concedida", async () => {
  guarda.mockResolvedValueOnce(undefined);
  recursos.add("configuracoes.brasilnfe");
  carregar.mockResolvedValueOnce({ ok: true, dados: configuracaoBrasilNfeFicticia });
  render(await BrasilNfePage());
  expect(carregar).toHaveBeenCalledOnce();
  expect(preRequisitos).toHaveBeenCalledOnce();
  expect(controle).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Validar conexão" })).toBeNull();
  expect(document.querySelectorAll("input")).toHaveLength(0);
});
