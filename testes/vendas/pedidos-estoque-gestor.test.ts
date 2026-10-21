import { describe, expect, it, vi } from "vitest";
import { politicaMovimentacaoEstoqueGestor } from "@/lib/vendas/pedidos-operacao-dominio";
import { Prisma } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn().mockResolvedValue({ userId: "operador", nome: "Operador fictício" }) }));
import { registrarMovimentacao, registrarConsumoAutomaticoGestorPedido } from "@/lib/estoque/registrarMovimentacao";

describe("Política servidora de estoque do Gestor", () => {
  it.each([undefined, null, [], "ligado", true, { movimentarEstoque: "true" }, { movimentarEstoque: 1 }, { ativa: true, locais: ["local"] }])("ausência/valor não booleano conserva OFF: %j", valor => {
    expect(politicaMovimentacaoEstoqueGestor(valor)).toMatchObject({ movimentarEstoque: false, versao: 0, localMovimentarEstoqueId: null });
  });
  it("somente true habilita e versão/local são validados independentemente", () => {
    expect(politicaMovimentacaoEstoqueGestor({ movimentarEstoque: true, versaoMovimentarEstoque: 3, localMovimentarEstoqueId: "local-ficticio" })).toEqual({ movimentarEstoque: true, versao: 3, localMovimentarEstoqueId: "local-ficticio" });
    expect(politicaMovimentacaoEstoqueGestor({ movimentarEstoque: true, versaoMovimentarEstoque: -1, localMovimentarEstoqueId: "local inválido" })).toEqual({ movimentarEstoque: true, versao: 0, localMovimentarEstoqueId: null });
  });
});

describe("Gravador compartilhado e exceção automática", () => {
  const tx = (saldo = "1", reservado = "2") => ({
    $executeRaw: vi.fn(),
    reservaPedido: { aggregate: vi.fn().mockResolvedValue({ _sum: { reservada: new Prisma.Decimal(reservado) } }), findFirst: vi.fn() },
    saldoEstoque: { findUnique: vi.fn().mockResolvedValue({ quantidadeAtual: new Prisma.Decimal(saldo) }), upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
    movimentacaoEstoque: { create: vi.fn().mockResolvedValue({ id: "movimento-ficticio" }) },
    atividadeUsuario: { create: vi.fn() },
    configuracaoLoja: { findUnique: vi.fn().mockResolvedValue({ pedidosLiberacao: { movimentarEstoque: true } }) },
    insumo: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
  });
  it.each(["SAIDA_CONSUMO", "SAIDA_PERDA", "AJUSTE_SAIDA"] as const)("%s normal continua protegendo as reservas", async tipo => {
    const banco = tx();
    await expect(registrarMovimentacao({ tx: banco as never, insumoId: "insumo", localId: "local", tipo, quantidade: 0.1 })).rejects.toThrow("reservada");
    expect(banco.saldoEstoque.upsert).not.toHaveBeenCalled(); expect(banco.movimentacaoEstoque.create).not.toHaveBeenCalled();
  });
  it("entrada e custo continuam no caminho público sem utilizar a exceção", async () => {
    const banco = tx();
    banco.saldoEstoque.upsert.mockResolvedValue({ quantidadeAtual: new Prisma.Decimal("3") });
    expect(await registrarMovimentacao({ tx: banco as never, insumoId: "insumo", localId: "local", tipo: "AJUSTE_ENTRADA", quantidade: 2, custoUnitario: 5, modoCusto: "NOVO" })).toMatchObject({ saldoAnterior: 1, saldoNovo: 3 });
    expect(banco.reservaPedido.aggregate).not.toHaveBeenCalled(); expect(banco.insumo.update).toHaveBeenCalledWith({ where: { id: "insumo" }, data: { custoMedio: 5 } });
  });
  it("automático exige política ON e reserva real do pedido antes da exceção", async () => {
    const banco = tx();
    banco.configuracaoLoja.findUnique.mockResolvedValue({ pedidosLiberacao: { movimentarEstoque: false } });
    await expect(registrarConsumoAutomaticoGestorPedido({ tx: banco as never, pedidoId: "pedido", reservaId: "reserva", quantidade: "1", usuarioId: "operador", observacao: "fictício" })).rejects.toThrow("indisponível");
    expect(banco.saldoEstoque.upsert).not.toHaveBeenCalled();
  });
  it("automático conserva número maior que 2^53 sem Number na gravação e reporta déficit/reservas exatos", async () => {
    const banco = tx("0", "2");
    const q = "9007199254740993.000001";
    banco.reservaPedido.findFirst.mockResolvedValue({ insumoId: "insumo", localId: "local", consumida: new Prisma.Decimal(q), snapshot: { tipoProduto: "MONTAGEM" }, item: { pedido: { status: "CONFIRMADO", statusOperacional: "EM_PREPARO", entregueEm: null } } });
    banco.saldoEstoque.upsert.mockResolvedValue({ quantidadeAtual: new Prisma.Decimal(`-${q}`) });
    banco.saldoEstoque.findUniqueOrThrow.mockResolvedValue({ quantidadeAtual: new Prisma.Decimal(`-${q}`) });
    const r = await registrarConsumoAutomaticoGestorPedido({ tx: banco as never, pedidoId: "pedido", reservaId: "reserva", quantidade: q, usuarioId: "operador", observacao: "fictício" });
    expect(banco.movimentacaoEstoque.create.mock.calls[0][0].data.quantidade.toString()).toBe(q);
    expect(banco.saldoEstoque.upsert.mock.calls[0][0].update.quantidadeAtual.increment.toString()).toBe(`-${q}`);
    expect(r).toMatchObject({ saldoAnterior: "0", saldoNovo: `-${q}`, reservasOutrosPedidos: "2", permitirSaldoNegativo: true });
  });
});
