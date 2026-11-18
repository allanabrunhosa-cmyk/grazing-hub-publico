// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const s = vi.hoisted(() => ({ salvar: vi.fn(), diagnostico: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/integracoes/mcp/actions", () => ({ salvarMcpAction: s.salvar, diagnosticarMcpAction: s.diagnostico }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: s.refresh }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
import { GestaoMcp } from "@/app/(protegido)/configuracoes/integracoes/mcp/gestao";
import { FaixaServidorMcp } from "@/app/(protegido)/configuracoes/integracoes/mcp/faixa-servidor";
import { dadosMcpFicticios, dadosMcpFicticiosEmUso } from "./fixture-gestao";
const preparada = dadosMcpFicticios.autorizacoes[0].id;
const [ativa, suspensa, revogada] = dadosMcpFicticiosEmUso.autorizacoes.map(a => a.id);
beforeEach(() => { s.salvar.mockReset().mockResolvedValue({ ok: true }); s.diagnostico.mockReset().mockResolvedValue({ ok: true }); });
afterEach(cleanup);

it("faixa do servidor mostra o endereço e exige confirmação para o acesso global, com falha persistente", async () => {
  s.salvar.mockResolvedValue({ erro: "Falha fictícia ao confirmar" });
  render(<FaixaServidorMcp endereco="https://hub.example.invalid/api/mcp" ativo={false} configurado editar />);
  expect(screen.getByText("https://hub.example.invalid/api/mcp")).toBeTruthy();
  await userEvent.click(screen.getByRole("switch", { name: "Status de Acesso global MCP" }));
  expect(s.salvar).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(s.salvar).toHaveBeenCalledWith({ tipo: "global", ativo: true }));
  expect((await screen.findAllByRole("alert"))[0].textContent).toContain("Falha fictícia");
});

it("faixa em consulta não habilita o acesso global e suspensão pede confirmação própria", async () => {
  const { unmount } = render(<FaixaServidorMcp endereco="https://hub.example.invalid/api/mcp" ativo configurado editar={false} />);
  expect((screen.getByRole("switch", { name: "Status de Acesso global MCP" }) as HTMLButtonElement).disabled).toBe(true);
  unmount();
  render(<FaixaServidorMcp endereco="https://hub.example.invalid/api/mcp" ativo configurado editar />);
  await userEvent.click(screen.getByRole("switch", { name: "Status de Acesso global MCP" }));
  expect(screen.getByText("Suspender todo o acesso MCP?")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(s.salvar).toHaveBeenCalledWith({ tipo: "global", ativo: false }));
});

it("conexão aguardando autorização mostra status, dados e funções sem conceder acesso", async () => {
  render(<GestaoMcp dados={dadosMcpFicticios} editar selecao={preparada} />);
  expect(screen.getByRole("heading", { name: "Aguardando autorização" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Análises financeiras" })).toBeTruthy();
  expect(screen.getByText(/acesso global ao MCP está suspenso/)).toBeTruthy();
  expect(screen.getByText(/^0 de \d+ funções liberadas/)).toBeTruthy();
  expect(screen.getByText("financeiro_dre")).toBeTruthy(); expect(screen.queryByText("executar_sql")).toBeNull();
  expect(screen.getByRole("button", { name: "Copiar identificador de Cliente de demonstração" })).toBeTruthy();
  expect(s.salvar).not.toHaveBeenCalled();
});

it("conexão ativa abre nas funções liberadas e a busca alcança as demais", async () => {
  render(<GestaoMcp dados={dadosMcpFicticiosEmUso} editar selecao={ativa} />);
  expect(screen.getByRole("heading", { name: "Conexão ativa" })).toBeTruthy();
  const dre = screen.getByText("financeiro_dre").closest("li")!;
  expect(within(dre).getByText("Liberada")).toBeTruthy();
  expect(screen.queryByText("pedidos_nova_tentativa")).toBeNull();
  await userEvent.click(screen.getByRole("combobox", { name: "Situação" }));
  await userEvent.click(await screen.findByRole("option", { name: "Todas" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Buscar função" }), "nova tentativa");
  const tentativa = screen.getByText("pedidos_nova_tentativa").closest("li")!;
  expect(within(tentativa).getByText("Sem permissão no HUB")).toBeTruthy();
  expect(within(tentativa).getByText(/Revisão humana autenticada obrigatória/)).toBeTruthy();
  expect(screen.queryByText("financeiro_dre")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
  expect(screen.getByText("financeiro_dre")).toBeTruthy();
  expect(s.salvar).not.toHaveBeenCalled();
});

it("revogação explica bloqueio definitivo e preservação de histórico antes de enviar", async () => {
  render(<GestaoMcp dados={dadosMcpFicticiosEmUso} editar selecao={ativa} />);
  await userEvent.click(screen.getByRole("button", { name: "Revogar" }));
  expect(screen.getByText(/revogação é definitiva/)).toBeTruthy(); expect(s.salvar).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(s.salvar).toHaveBeenCalledWith(expect.objectContaining({ id: ativa, situacao: "REVOGADA" })));
});

it("ações seguem a situação: suspensa repreparar, revogada sem ações e consulta sem edição", async () => {
  const { unmount } = render(<GestaoMcp dados={dadosMcpFicticiosEmUso} editar selecao={suspensa} />);
  expect(screen.getByRole("heading", { name: "Conexão suspensa" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Repreparar" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(s.salvar).toHaveBeenCalledWith(expect.objectContaining({ id: suspensa, situacao: "PREPARADA" })));
  unmount();
  const revogadaTela = render(<GestaoMcp dados={dadosMcpFicticiosEmUso} editar selecao={revogada} />);
  expect(screen.getByRole("heading", { name: "Conexão revogada" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Revogar" })).toBeNull(); expect(screen.queryByRole("button", { name: "Suspender" })).toBeNull();
  revogadaTela.unmount();
  render(<GestaoMcp dados={dadosMcpFicticiosEmUso} editar={false} selecao={ativa} />);
  expect((screen.getByRole("button", { name: "Revogar" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Suspender" }) as HTMLButtonElement).disabled).toBe(true);
});

it("nova conexão indica o próximo passo conforme o que já foi concluído", () => {
  render(<GestaoMcp dados={dadosMcpFicticios} editar selecao="nova" />);
  expect(screen.getByText("Autorize pelo assistente").closest("li")!.getAttribute("aria-current")).toBe("step");
  expect(screen.getAllByText("Concluído")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Cadastrar aplicação" })).toBeTruthy();
  expect(s.salvar).not.toHaveBeenCalled();
});

it("servidor reúne diagnóstico, aplicações, histórico e catálogo completo", async () => {
  render(<GestaoMcp dados={dadosMcpFicticiosEmUso} editar selecao="servidor" />);
  expect(screen.getByRole("heading", { name: "Há verificações pendentes ou com falha" })).toBeTruthy();
  expect(screen.getByText("Credencial inválida")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Catálogo de funções" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Situação" })).toBeNull();
  expect(screen.getByRole("link", { name: "Aplicar filtros" }).getAttribute("href")).toContain("conexao=servidor");
  await userEvent.click(screen.getByRole("button", { name: "Executar diagnóstico" }));
  await waitFor(() => expect(s.diagnostico).toHaveBeenCalledOnce());
});
