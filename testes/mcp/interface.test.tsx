// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const s = vi.hoisted(() => ({ salvar: vi.fn(), diagnostico: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/integracoes/mcp/actions", () => ({ salvarMcpAction: s.salvar, diagnosticarMcpAction: s.diagnostico }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: s.refresh }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
import { GestaoMcp } from "@/app/(protegido)/configuracoes/integracoes/mcp/gestao";
import { dadosMcpFicticios } from "./fixture-gestao";
beforeEach(() => { s.salvar.mockReset().mockResolvedValue({ ok: true }); s.diagnostico.mockReset().mockResolvedValue({ ok: true }); });
afterEach(cleanup);
it("distingue configuração de conexão e mantém endereço não editável", () => {
  render(<GestaoMcp dados={dadosMcpFicticios} editar />);
  expect(screen.getByText("Nenhuma consulta externa registrada")).toBeTruthy();
  expect((screen.getByLabelText("Endereço técnico do servidor") as HTMLInputElement).readOnly).toBe(true);
  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(screen.queryByRole("tab", { name: "Perfis de acesso" })).toBeNull();
});
it("suspensão/ativação global exige confirmação e mostra falha persistente", async () => {
  s.salvar.mockResolvedValue({ erro: "Falha fictícia ao confirmar" }); render(<GestaoMcp dados={dadosMcpFicticios} editar />);
  await userEvent.click(screen.getByRole("switch", { name: "Status de Acesso global MCP" }));
  expect(s.salvar).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(s.salvar).toHaveBeenCalledWith({ tipo: "global", ativo: true }));
  expect((await screen.findAllByRole("alert"))[0].textContent).toContain("Falha fictícia");
});
it("consulta de gestão não habilita alterações e catálogo vem das funções reais", async () => {
  render(<GestaoMcp dados={dadosMcpFicticios} editar={false} />);
  expect((screen.getByRole("switch", { name: "Status de Acesso global MCP" }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("tab", { name: "Funções disponíveis" }));
  expect(screen.getByText("financeiro_dre")).toBeTruthy(); expect(screen.queryByText("executar_sql")).toBeNull();
});
it("revogação explica bloqueio definitivo e preservação de histórico antes de enviar", async () => {
  render(<GestaoMcp dados={dadosMcpFicticios} editar abaInicial="conexoes" />);
  await userEvent.click(screen.getByRole("button", { name: "Revogar" }));
  expect(screen.getByText(/revogação é definitiva/)).toBeTruthy(); expect(s.salvar).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(s.salvar).toHaveBeenCalledWith(expect.objectContaining({ situacao: "REVOGADA" })));
});

it("busca e filtros do catálogo usam funções reais sem controles de concessão", async () => {
  render(<GestaoMcp dados={dadosMcpFicticios} editar abaInicial="funcoes" />);
  await userEvent.type(screen.getByRole("textbox", { name: "Buscar função" }), "nova tentativa");
  expect(screen.getByText("pedidos_nova_tentativa")).toBeTruthy();
  expect(screen.queryByText("financeiro_dre")).toBeNull();
  expect(screen.getByText(/Revisão humana autenticada obrigatória/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
  expect(screen.getByText("financeiro_dre")).toBeTruthy();
  expect(s.salvar).not.toHaveBeenCalled();
});
