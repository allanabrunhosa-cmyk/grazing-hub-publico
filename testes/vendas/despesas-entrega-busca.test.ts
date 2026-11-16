import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";

const sim = vi.hoisted(() => ({ buscar: vi.fn(), acesso: vi.fn(), autor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (executar: (tx: unknown) => Promise<unknown>) => executar({ lancamentoFinanceiro: { findMany: sim.buscar } }) } }));
vi.mock("@/lib/vendas/pedidos", () => ({ conferirAcesso: sim.acesso }));
vi.mock("@/lib/vendas/entregas", () => ({ autorEntregas: sim.autor }));
import { buscarDespesasEntrega } from "@/lib/vendas/entregas-custos";

const sessao = { userId: "usuario-ficticio" } as SessaoAtual;
beforeEach(() => { vi.resetAllMocks(); sim.buscar.mockResolvedValue([]); });

describe("Busca de despesas existentes para entrega", () => {
  it.each(["308", "308,00", "308.00", "R$ 308,00"])("pesquisa %s pelo valor completo antes do limite de resultados", async busca => {
    await buscarDespesasEntrega(busca, sessao);
    expect(sim.acesso).toHaveBeenCalledWith(expect.anything(), sessao, ["consultar", "condicao"]);
    expect(sim.autor).toHaveBeenCalledWith(expect.anything(), sessao, "vendas.pedidos.logistica");
    expect(sim.buscar).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tipo: "DESPESA", status: { not: "CANCELADO" }, pedidoVendaId: null,
        OR: expect.arrayContaining([{ valor: { in: ["308.00", "-308.00"] } }]),
      }), take: 50,
    }));
  });
  it("aceita valor de um dígito e preserva a busca textual", async () => {
    await buscarDespesasEntrega("8", sessao);
    expect(sim.buscar.mock.calls[0][0].where.OR).toContainEqual({ valor: { in: ["8.00", "-8.00"] } });
    await buscarDespesasEntrega(" Transporte ", sessao);
    expect(sim.buscar.mock.calls[1][0].where.OR).toEqual([
      { descricao: { contains: "Transporte", mode: "insensitive" } },
      { fornecedor: { nome: { contains: "Transporte", mode: "insensitive" } } },
    ]);
  });
  it("respeita sinal explícito e não interpreta decimal inválido como valor", async () => {
    await buscarDespesasEntrega("-308,00", sessao);
    expect(sim.buscar.mock.calls[0][0].where.OR).toContainEqual({ valor: { in: ["-308.00"] } });
    await buscarDespesasEntrega("308,001", sessao);
    expect(sim.buscar.mock.calls[1][0].where.OR).toHaveLength(2);
  });
  it("rejeita entrada vazia, texto curto e excesso de tamanho antes da consulta", async () => {
    for (const busca of ["", " ", "a", "8".repeat(121)]) expect(await buscarDespesasEntrega(busca, sessao)).toEqual([]);
    expect(sim.buscar).not.toHaveBeenCalled();
  });
  it("mantém o bloqueio de acesso antes de consultar despesas", async () => {
    sim.acesso.mockRejectedValue(new Error("Sem acesso"));
    await expect(buscarDespesasEntrega("308", sessao)).rejects.toThrow("Sem acesso");
    expect(sim.buscar).not.toHaveBeenCalled();
  });
});
