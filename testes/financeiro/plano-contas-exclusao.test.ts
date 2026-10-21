import { beforeEach, describe, expect, it, vi } from "vitest";

const sim = vi.hoisted(() => ({
  sessao: vi.fn(),
  usuario: vi.fn(),
  categoriaEncontrar: vi.fn(),
  categoriaContar: vi.fn(),
  categoriaListar: vi.fn(),
  categoriaAtualizar: vi.fn(),
  lancamentoContar: vi.fn(),
  lancamentoAtualizar: vi.fn(),
  itemNotaContar: vi.fn(),
  itemNotaAtualizar: vi.fn(),
  itemFaturaContar: vi.fn(),
  itemFaturaAtualizar: vi.fn(),
  regraCartaoContar: vi.fn(),
  regraCartaoAtualizar: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: sim.usuario },
    $transaction: async (executar: (tx: unknown) => unknown) => executar({
      categoriaFinanceira: {
        findUnique: sim.categoriaEncontrar,
        count: sim.categoriaContar,
        findMany: sim.categoriaListar,
        updateMany: sim.categoriaAtualizar,
      },
      lancamentoFinanceiro: { count: sim.lancamentoContar, updateMany: sim.lancamentoAtualizar },
      notaFiscalItem: { count: sim.itemNotaContar, updateMany: sim.itemNotaAtualizar },
      itemFaturaCartao: { count: sim.itemFaturaContar, updateMany: sim.itemFaturaAtualizar },
      regraCartao: { count: sim.regraCartaoContar, updateMany: sim.regraCartaoAtualizar },
    }),
  },
}));

import { alternarAtivoCategoriaFinanceiraAction, excluirCategoriaFinanceiraAction } from "@/app/(protegido)/financeiro/plano-de-contas/actions";

beforeEach(() => {
  vi.resetAllMocks();
  sim.sessao.mockResolvedValue({ userId: "usuario" });
  sim.usuario.mockResolvedValue({ ativo: true });
  sim.categoriaEncontrar.mockResolvedValue({ id: "origem", grupo: "DESPESAS_OPERACIONAIS", excluidoEm: null, pai: null });
  sim.categoriaContar.mockResolvedValue(0);
  sim.categoriaListar.mockResolvedValue([{ id: "origem" }]);
  sim.categoriaAtualizar.mockResolvedValue({ count: 1 });
  sim.lancamentoContar.mockResolvedValue(0);
  sim.itemNotaContar.mockResolvedValue(0);
  sim.itemFaturaContar.mockResolvedValue(0);
  sim.regraCartaoContar.mockResolvedValue(0);
  sim.lancamentoAtualizar.mockResolvedValue({ count: 0 });
  sim.itemNotaAtualizar.mockResolvedValue({ count: 0 });
  sim.itemFaturaAtualizar.mockResolvedValue({ count: 0 });
  sim.regraCartaoAtualizar.mockResolvedValue({ count: 0 });
});

describe("exclusão de categorias financeiras", () => {
  it("exige uma categoria de destino quando existem vínculos", async () => {
    sim.lancamentoContar.mockImplementation(async (q) => q.where.pedidoVendaId ? 0 : 3);

    expect(await excluirCategoriaFinanceiraAction("origem", null)).toEqual({
      erro: "Escolha uma categoria ativa para receber as movimentações vinculadas.",
    });
    expect(sim.lancamentoAtualizar).not.toHaveBeenCalled();
    expect(sim.categoriaAtualizar).not.toHaveBeenCalled();
  });

  it("transfere lançamentos e itens de nota antes da exclusão lógica", async () => {
    sim.categoriaEncontrar
      .mockResolvedValueOnce({ id: "origem", grupo: "DESPESAS_OPERACIONAIS", excluidoEm: null })
      .mockResolvedValueOnce({ id: "destino", grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null });
    sim.lancamentoContar.mockImplementation(async (q) => q.where.pedidoVendaId ? 0 : 2);
    sim.itemNotaContar.mockResolvedValue(1);

    expect(await excluirCategoriaFinanceiraAction("origem", "destino")).toEqual({ ok: true, transferidos: 3 });
    expect(sim.lancamentoAtualizar).toHaveBeenCalledWith({ where: { categoriaId: "origem" }, data: { categoriaId: "destino" } });
    expect(sim.itemNotaAtualizar).toHaveBeenCalledWith({ where: { categoriaFinanceiraId: "origem" }, data: { categoriaFinanceiraId: "destino" } });
    expect(sim.categoriaAtualizar).toHaveBeenCalledWith({
      where: { id: "origem", excluidoEm: null },
      data: { ativo: false, excluidoEm: expect.any(Date) },
    });
  });

  it("exige destino e transfere classificação e regras de faturas de cartão", async () => {
    sim.itemFaturaContar.mockResolvedValue(4);
    sim.regraCartaoContar.mockResolvedValue(1);
    expect(await excluirCategoriaFinanceiraAction("origem")).toEqual({ erro: "Escolha uma categoria ativa para receber as movimentações vinculadas." });
    sim.categoriaEncontrar.mockResolvedValueOnce({ id: "origem", grupo: "DESPESAS_OPERACIONAIS", excluidoEm: null }).mockResolvedValueOnce({ id: "destino", grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null });
    expect(await excluirCategoriaFinanceiraAction("origem", "destino")).toEqual({ ok: true, transferidos: 5 });
    expect(sim.itemFaturaAtualizar).toHaveBeenCalledWith({ where: { categoriaId: "origem" }, data: { categoriaId: "destino" } });
    expect(sim.regraCartaoAtualizar).toHaveBeenCalledWith({ where: { categoriaId: "origem" }, data: { categoriaId: "destino" } });
  });

  it("rejeita destino inativo ou de outro grupo", async () => {
    sim.categoriaEncontrar
      .mockResolvedValueOnce({ id: "origem", grupo: "DESPESAS_OPERACIONAIS", excluidoEm: null })
      .mockResolvedValueOnce({ id: "destino", grupo: "CMV", ativo: true, excluidoEm: null });
    sim.lancamentoContar.mockImplementation(async (q) => q.where.pedidoVendaId ? 0 : 1);

    expect(await excluirCategoriaFinanceiraAction("origem", "destino")).toEqual({
      erro: "A categoria de destino deve estar ativa e pertencer ao mesmo grupo da DRE.",
    });
  });

  it("protege categorias que ainda possuem subcategorias", async () => {
    sim.categoriaContar.mockResolvedValue(2);
    expect(await excluirCategoriaFinanceiraAction("origem")).toEqual({
      erro: "Exclua primeiro as subcategorias desta categoria.",
    });
    expect(sim.lancamentoContar).not.toHaveBeenCalled();
  });
});

describe("ativação e inativação de categorias financeiras", () => {
  it("inativa também as categorias descendentes", async () => {
    sim.categoriaListar.mockResolvedValue([{ id: "origem" }, { id: "filha" }, { id: "neta" }]);
    expect(await alternarAtivoCategoriaFinanceiraAction("origem", false)).toEqual({ ok: true });
    expect(sim.categoriaAtualizar).toHaveBeenCalledWith({
      where: { id: { in: ["origem", "filha", "neta"] }, excluidoEm: null },
      data: { ativo: false },
    });
  });

  it("não ativa uma categoria cujo nível superior está inativo", async () => {
    sim.categoriaEncontrar.mockResolvedValue({ id: "filha", excluidoEm: null, pai: { ativo: false, excluidoEm: null, pai: null } });
    expect(await alternarAtivoCategoriaFinanceiraAction("filha", true)).toEqual({ erro: "Ative primeiro as categorias superiores." });
    expect(sim.categoriaAtualizar).not.toHaveBeenCalled();
  });
});

it("bloqueia reclassificação genérica de títulos vinculados a Pedidos", async () => {
  sim.lancamentoContar.mockResolvedValue(1);
  expect(await excluirCategoriaFinanceiraAction("origem", "destino")).toEqual({ erro: "Há títulos de Pedidos nesta categoria; revise a integração antes de transferi-los." });
  expect(sim.lancamentoAtualizar).not.toHaveBeenCalled();
  expect(sim.categoriaAtualizar).not.toHaveBeenCalled();
});
