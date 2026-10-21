import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";

const sim = vi.hoisted(() => ({ sessao: vi.fn(), mudar: vi.fn(), salvar: vi.fn(), revalidar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/vendas/pedidos", () => ({ mudarStatusGestorPedido: sim.mudar, salvarMovimentacaoEstoqueGestorPedidos: sim.salvar }));
vi.mock("next/cache", () => ({ revalidatePath: sim.revalidar }));
vi.mock("next/navigation", () => ({ redirect: (destino: string) => { throw new Error(`REDIRECT:${destino}`); } }));

import { mudarStatusGestorPedidoAction, salvarMovimentacaoEstoqueGestorPedidosAction } from "@/app/(protegido)/vendas/pedidos/gestor-actions";

beforeEach(() => {
  sim.sessao.mockResolvedValue({ userId: "operador-ficticio", admin: false, permissoes: { "vendas.pedidos": ["visualizar"], "vendas.pedidos.revisar": ["editar"] }, excecoes: {} });
  sim.mudar.mockResolvedValue({ id: "pedido-ficticio", numero: 7, versao: 5, status: "CONFIRMADO", statusOperacional: "EM_ENTREGA" });
});

describe("Ação do gestor de pedidos", () => {
  it.each([
    [null, "/login"],
    [{ userId: "sem-pedidos", admin: false, permissoes: { "compras": ["visualizar"] }, excecoes: {} }, "/sem-acesso"],
    [{ userId: "revisor-sem-consulta", admin: false, permissoes: { "vendas.pedidos.revisar": ["editar"] }, excecoes: {} }, "/sem-acesso"],
  ])("recusa a fronteira sem acesso antes de chamar o domínio", async (sessao, destino) => {
    sim.sessao.mockResolvedValue(sessao);
    await expect(mudarStatusGestorPedidoAction("pedido-ficticio", 4, "voltar", "chave-ficticia-gestor-001")).rejects.toThrow(`REDIRECT:${destino}`);
    expect(sim.mudar).not.toHaveBeenCalled();
    expect(sim.revalidar).not.toHaveBeenCalled();
  });

  it("encaminha versão, direção e chave e revalida pedido e estoque, sem financeiro", async () => {
    expect(await mudarStatusGestorPedidoAction("pedido-ficticio", 4, "voltar", "chave-ficticia-gestor-001")).toEqual({ ok: true, id: "pedido-ficticio", numero: 7, versao: 5, status: "CONFIRMADO", statusOperacional: "EM_ENTREGA" });
    expect(sim.mudar).toHaveBeenCalledWith("pedido-ficticio", 4, "voltar", "chave-ficticia-gestor-001", expect.objectContaining({ userId: "operador-ficticio" }));
    expect(sim.revalidar).toHaveBeenCalledWith("/vendas/pedidos");
    expect(sim.revalidar).toHaveBeenCalledWith("/vendas/pedidos/pedido-ficticio/operacao");
    expect(sim.revalidar.mock.calls.flat().some(p => p.startsWith("/financeiro"))).toBe(false);
  });

  it("mantém o impedimento do domínio visível sem anunciar atualização", async () => {
    sim.mudar.mockRejectedValue(new ErroPedidoVenda("Registre todas as quantidades antes de avançar."));
    expect(await mudarStatusGestorPedidoAction("pedido-ficticio", 4, "avancar", "chave-ficticia-gestor-002")).toEqual({ erro: "Registre todas as quantidades antes de avançar." });
    expect(sim.revalidar).not.toHaveBeenCalled();
  });

  it("não expõe detalhes internos em uma falha inesperada", async () => {
    sim.mudar.mockRejectedValue(new Error("Detalhe privado da conexão"));
    expect(await mudarStatusGestorPedidoAction("pedido-ficticio", 4, "avancar", "chave-ficticia-gestor-003")).toEqual({ erro: "Não foi possível confirmar a etapa. Confira o pedido antes de tentar novamente." });
  });
});

describe("Configuração de estoque do Gestor", () => {
  it("encaminha local explícito, versão e chave ao domínio e devolve confirmação", async () => {
    sim.salvar.mockResolvedValue({ movimentarEstoque: true, versao: 2, localMovimentarEstoqueId: "local-ficticio" });
    expect(await salvarMovimentacaoEstoqueGestorPedidosAction(true, 1, "chave-config-ficticia-01", "local-ficticio")).toEqual({ ok: true, movimentarEstoque: true, versao: 2, localMovimentarEstoqueId: "local-ficticio" });
    expect(sim.salvar).toHaveBeenCalledWith(true, 1, "chave-config-ficticia-01", expect.objectContaining({ userId: "operador-ficticio" }), "local-ficticio");
    expect(sim.revalidar).toHaveBeenCalledWith("/vendas/pedidos", "layout");
  });
  it("preserva erro acionável e oculta falha inesperada", async () => {
    sim.salvar.mockRejectedValueOnce(new ErroPedidoVenda("Escolha um local ativo autorizado."));
    expect(await salvarMovimentacaoEstoqueGestorPedidosAction(true, 1, "chave-config-ficticia-02", null)).toEqual({ erro: "Escolha um local ativo autorizado." });
    expect(sim.revalidar).not.toHaveBeenCalled();
    sim.salvar.mockRejectedValueOnce(new Error("conexão privada"));
    expect(await salvarMovimentacaoEstoqueGestorPedidosAction(false, 1, "chave-config-ficticia-03", null)).toEqual({ erro: "Não foi possível salvar a configuração de estoque. Reabra antes de tentar novamente." });
  });
});
