// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { ConteudoMenuLateral } from "@/components/layout/sidebar";
import IntegracoesPage from "@/app/(protegido)/configuracoes/integracoes/page";
import { MolduraIntegracoes, conexaoMcpInicial, itensDoSeletor } from "@/app/(protegido)/configuracoes/integracoes/seletor";
import ConfiguracoesPage from "@/app/(protegido)/configuracoes/page";
import { BlocoEmissorFiscal } from "@/app/(protegido)/financeiro/fiscal/configuracoes/emissor";
import BrasilNfePage from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/page";
import CertificadoIntegracaoPage from "@/app/(protegido)/configuracoes/integracoes/certificado/page";
import { configuracaoBrasilNfeFicticia } from "../fiscal-saida/brasilnfe-interface-dados";
import { preRequisitosBrasilNfeVazios } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";

const { recursos, guarda, redirecionar, carregar, preRequisitos, controle } = vi.hoisted(() => ({ recursos: new Set<string>(), guarda: vi.fn(async (): Promise<void> => { throw new Error("SEM_ACESSO"); }), carregar: vi.fn(), preRequisitos: vi.fn(), controle: vi.fn(), redirecionar: vi.fn((rota: string) => { throw new Error(`REDIRECT:${rota}`); }) }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: vi.fn(async (recurso: string, acao = "visualizar") => recursos.has(acao === "visualizar" ? recurso : `${recurso}:${acao}`)), exigirPermissao: guarda }));
vi.mock("@/app/(protegido)/configuracoes/integracoes/brasilnfe-actions", () => ({ obterConfiguracaoBrasilNfeAction: carregar, salvarConfiguracaoBrasilNfeAction: vi.fn(), validarConexaoBrasilNfeAction: vi.fn(), obterPreRequisitosBrasilNfeAction: preRequisitos, registrarEvidenciaPainelBrasilNfeAction: vi.fn(), verificarPreRequisitosBrasilNfeAction: vi.fn(), obterHabilitacaoEmissaoBrasilNfeAction: controle, configurarHabilitacaoEmissaoBrasilNfeAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/configuracoes/integracoes/brasilnfe", redirect: redirecionar, useRouter: () => ({ refresh: vi.fn() }) }));
const leituraCertificado = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { certificadoDigital: { findUnique: leituraCertificado } } }));
vi.mock("@/app/(protegido)/configuracoes/actions", () => ({ uploadCertificadoAction: vi.fn(), removerCertificadoAction: vi.fn(), obterSenhaCertificadoAction: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/integracoes/mcp/actions", () => ({ salvarMcpAction: vi.fn(), diagnosticarMcpAction: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/integracoes/resumo", () => ({ carregarResumoIntegracoes: vi.fn(async () => ({ mcp: null, brasilnfe: true, certificado: null })) }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));
beforeEach(() => { vi.clearAllMocks(); recursos.clear(); preRequisitos.mockResolvedValue({ ok: true, dados: preRequisitosBrasilNfeVazios(1) }); controle.mockResolvedValue({ ok: false, erro: "Controle indisponível na fixture sintética." }); });
afterEach(cleanup);

it("abre a integração MCP selecionada quando há acesso ao MCP, com ou sem acesso fiscal", async () => {
  recursos.add("configuracoes.mcp");
  await expect(IntegracoesPage()).rejects.toThrow("REDIRECT:/configuracoes/integracoes/mcp");
  recursos.add("configuracoes.brasilnfe");
  await expect(IntegracoesPage()).rejects.toThrow("REDIRECT:/configuracoes/integracoes/mcp");
});

it("perfil somente fiscal entra direto na Brasil NFe", async () => {
  recursos.add("configuracoes.brasilnfe");
  await expect(IntegracoesPage()).rejects.toThrow("REDIRECT:/configuracoes/integracoes/brasilnfe");
});

const servidorMcp = { endereco: "https://hub.example.invalid/api/mcp", ativo: true, configurado: true, editar: true, conexoes: [{ id: "c-revogada", nome: "Conexão revogada", clienteNome: "Cliente fictício", situacao: "REVOGADA" }, { id: "c-ativa", nome: "Análises fictícias", clienteNome: "Cliente fictício", situacao: "ATIVA" }] };

it("seletor lista as conexões vigentes, sem revogadas, com Nova conexão fora da grade", () => {
  render(<MolduraIntegracoes ativa="mcp:c-ativa" resumo={{ mcp: servidorMcp, brasilnfe: true, certificado: { resumo: "Válido até 01/01/2027", tom: "roxo" } }}><p>Detalhe fictício</p></MolduraIntegracoes>);
  // Iniciais e marca são decorativas (aria-hidden): o texto conferido é o que o leitor de tela anuncia.
  const grade = within(screen.getByRole("navigation", { name: "Conexões" })).getAllByRole("link");
  const nomes = grade.map(l => [...l.children].filter(f => f.getAttribute("aria-hidden") !== "true").map(f => f.textContent).join(""));
  expect(grade.map(l => l.querySelector("[aria-hidden=true]")?.textContent)).toEqual(["CF", "", "", "GH"]);
  expect(nomes.map(n => n?.split("Cliente")[0])).toEqual(["Análises fictícias", "Brasil NFeEmissão de NF-e e NFC-e", "Certificado A1Válido até 01/01/2027", "Servidor MCPDiagnóstico, aplicações e histórico"]);
  expect(screen.queryByText("Conexão revogada")).toBeNull();
  // Criar conexão é uma ação separada, acima da grade.
  const nova = screen.getByRole("link", { name: "Nova conexão" });
  expect(nova.getAttribute("href")).toBe("/configuracoes/integracoes/mcp?conexao=nova");
  expect(screen.getByRole("navigation", { name: "Conexões" }).contains(nova)).toBe(false);
  expect(screen.getByRole("link", { name: /Análises fictícias/ }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: /Brasil NFe/ }).getAttribute("href")).toBe("/configuracoes/integracoes/brasilnfe");
  expect(screen.getByRole("link", { name: /Certificado A1/ }).getAttribute("href")).toBe("/configuracoes/integracoes/certificado");
  expect(screen.getByText("https://hub.example.invalid/api/mcp")).toBeTruthy();
  expect(screen.getByText("Detalhe fictício")).toBeTruthy();
});

it("seletor omite o que a pessoa não pode ver e não oferece nova conexão sem edição", () => {
  expect(itensDoSeletor({ mcp: null, brasilnfe: true, certificado: null }).map(i => i.id)).toEqual(["brasilnfe"]);
  expect(itensDoSeletor({ mcp: { ...servidorMcp, editar: false }, brasilnfe: false, certificado: null }).map(i => i.id)).toEqual(["mcp:c-ativa", "mcp:servidor"]);
  expect(itensDoSeletor({ mcp: { ...servidorMcp, conexoes: [{ ...servidorMcp.conexoes[0], situacao: "SUSPENSA" }, { ...servidorMcp.conexoes[1], situacao: "PREPARADA" }] }, brasilnfe: false, certificado: null }).map(i => i.id)).toEqual(["mcp:c-revogada", "mcp:c-ativa", "mcp:servidor"]);
  render(<MolduraIntegracoes ativa="mcp:servidor" resumo={{ mcp: { ...servidorMcp, editar: false }, brasilnfe: false, certificado: null }}><p>Sem edição</p></MolduraIntegracoes>);
  expect(screen.queryByRole("link", { name: "Nova conexão" })).toBeNull();
  expect(conexaoMcpInicial(servidorMcp)).toBe("c-ativa");
  expect(conexaoMcpInicial({ ...servidorMcp, conexoes: [] })).toBe("nova");
  expect(conexaoMcpInicial({ ...servidorMcp, editar: false, conexoes: [servidorMcp.conexoes[0]] })).toBe("servidor");
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
  await expect(ConfiguracoesPage()).rejects.toThrow("REDIRECT:/configuracoes/integracoes");
});

it("protege o Certificado A1 pela permissão de dados da empresa antes de qualquer leitura", async () => {
  recursos.add("configuracoes.mcp"); recursos.add("configuracoes.brasilnfe");
  await expect(CertificadoIntegracaoPage()).rejects.toThrow("SEM_ACESSO");
  expect(guarda).toHaveBeenCalledWith("configuracoes.loja");
  expect(leituraCertificado).not.toHaveBeenCalled();
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
  render(await BlocoEmissorFiscal());
  expect(carregar).toHaveBeenCalledOnce();
  expect(preRequisitos).toHaveBeenCalledOnce();
  expect(controle).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Validar conexão" })).toBeNull();
  expect(document.querySelectorAll("input")).toHaveLength(0);
});
