import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { aceitaMotivoCancelamento, aceitaNomeResponsavelCancelamento, validarMotivoCancelamento, validarResponsavelCancelamento } from "@/lib/vendas/cancelamento-pedido-dominio";

const sim = vi.hoisted(() => ({ autorizar: vi.fn(), cancelar: vi.fn(), atualizar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.autorizar }));
vi.mock("@/lib/vendas/pedidos", () => ({ cancelarPedido: sim.cancelar }));
vi.mock("next/cache", () => ({ revalidatePath: sim.atualizar }));
import { cancelarPedidoVendaAction } from "@/app/(protegido)/vendas/pedidos/actions";

const sessao = { userId: "operador-sintetico", nome: "Operador autenticado sintético", admin: false };
beforeEach(() => {
  vi.resetAllMocks();
  sim.autorizar.mockResolvedValue(sessao);
  sim.cancelar.mockResolvedValue({ id: "pedido-sintetico", numero: 101, versao: 3, status: "CANCELADO" });
});

describe("entrada do cancelamento", () => {
  it("normaliza o nome informado sem exigir que corresponda ao usuário autenticado", () => {
    expect(validarResponsavelCancelamento("  Jose\u0301   D’Ávila-Silva Jr. ")).toBe("José D’Ávila-Silva Jr.");
    expect(validarResponsavelCancelamento("A".repeat(120))).toHaveLength(120);
    expect(aceitaNomeResponsavelCancelamento("")).toBe(true);
  });
  it.each([undefined, null, 123, "", "   ", "...---", "Ana123", "Ana\nSilva", "<Ana>", "A".repeat(121)])("recusa responsável inválido %j", nome => {
    expect(() => validarResponsavelCancelamento(nome)).toThrow(ErroPedidoVenda);
  });
  it("aceita motivo comercial com quebras de linha e limita a mil caracteres", () => {
    expect(validarMotivoCancelamento(" Cliente solicitou\nadiamento. ")).toBe("Cliente solicitou\nadiamento.");
    expect(validarMotivoCancelamento("M".repeat(1000))).toHaveLength(1000);
    expect(aceitaMotivoCancelamento("Motivo\u0000oculto")).toBe(false);
  });
  it.each([undefined, null, 123, "", "  ", "M".repeat(1001), "Motivo\u0000oculto"])("recusa motivo inválido %j", motivo => {
    expect(() => validarMotivoCancelamento(motivo)).toThrow(ErroPedidoVenda);
  });
});

describe("action interativa de cancelamento", () => {
  it("exige permissão antes de validar ou executar qualquer cancelamento", async () => {
    sim.autorizar.mockRejectedValue(new Error("Acesso negado"));
    await expect(cancelarPedidoVendaAction("pedido-sintetico", 2, "", "chave-sintetica")).rejects.toThrow("Acesso negado");
    expect(sim.autorizar).toHaveBeenCalledExactlyOnceWith("vendas.pedidos.cancelar", "editar");
    expect(sim.cancelar).not.toHaveBeenCalled(); expect(sim.atualizar).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "123", "R".repeat(121)])("exige nome informado válido %j mesmo havendo sessão autorizada", async nome => {
    expect(await cancelarPedidoVendaAction("pedido-sintetico", 2, "Cliente desistiu", "chave-sintetica", undefined, nome)).toEqual({ erro: expect.stringContaining("nome do responsável") });
    expect(sim.cancelar).not.toHaveBeenCalled(); expect(sim.atualizar).not.toHaveBeenCalled();
  });
  it.each(["", "M".repeat(1001), "motivo\u0000oculto"])("exige motivo válido %j sem cancelar", async motivo => {
    expect(await cancelarPedidoVendaAction("pedido-sintetico", 2, motivo, "chave-sintetica", undefined, "Responsável sintético")).toEqual({ erro: expect.stringContaining("motivo") });
    expect(sim.cancelar).not.toHaveBeenCalled(); expect(sim.atualizar).not.toHaveBeenCalled();
  });
  it("repassa identidade autenticada, nome informado e tratamento financeiro separadamente", async () => {
    const tratamento = { destino: "DEVOLUCAO" as const, reter: "10.00", politica: "Política sintética", comunicacao: "Conversa sintética" };
    expect(await cancelarPedidoVendaAction("pedido-sintetico", 2, " Cliente desistiu ", "chave-sintetica", tratamento, "  Responsável   sintético ")).toEqual({ ok: true, id: "pedido-sintetico", numero: 101, versao: 3, status: "CANCELADO" });
    expect(sim.cancelar).toHaveBeenCalledExactlyOnceWith("pedido-sintetico", 2, "Cliente desistiu", "chave-sintetica", sessao, tratamento, "Responsável sintético");
    expect(sim.atualizar).toHaveBeenCalledWith("/vendas/pedidos/pedido-sintetico");
    expect(sim.atualizar).toHaveBeenCalledWith("/financeiro/movimentacoes");
  });
  it("preserva a recusa do domínio sem indicar sucesso nem invalidar páginas", async () => {
    sim.cancelar.mockRejectedValue(new ErroPedidoVenda("O pedido mudou em outra tela."));
    expect(await cancelarPedidoVendaAction("pedido-sintetico", 2, "Cliente desistiu", "chave-sintetica", undefined, "Responsável sintético")).toEqual({ erro: "O pedido mudou em outra tela." });
    expect(sim.atualizar).not.toHaveBeenCalled();
  });
});
