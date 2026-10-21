import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pedidoRemoto } from "./fixtures";

const sim = vi.hoisted(() => ({ transaction: vi.fn(), requisicao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: sim.transaction } }));
vi.mock("@/lib/ifood/tokens", () => ({ requisicaoAutorizada: sim.requisicao, cifrarIfood: () => "snapshot-sintetico-cifrado", decifrarIfood: () => ({}) }));
vi.mock("@/lib/ifood/acompanhamento", () => ({ filtroRecepcaoSql: () => "true", recepcaoPermitida: () => true }));
vi.mock("@/lib/ifood/financeiro", () => ({ projetarFinanceiro: vi.fn() }));
import { processarEvento } from "@/lib/ifood/processamento";

const clientes = new Map<string, { id: string; unificadoEmId: string | null }>();
const vinculo = { destinoId: "alias-ifood", dadosOrigem: { nome: "Cliente original" } };
const evento = { id: "evento-sintetico", lojaId: "loja-sintetica", pedidoExternoId: pedidoRemoto().id, codigo: "PLC", codigoCompleto: "PLACED", externoId: "evento-externo", ocorridoEm: new Date("2026-10-19T12:00:00Z"), metadataCifrada: null, loja: { id: "loja-sintetica", ativa: true, autorizada: true, ambiente: "TESTE", modoOperacao: "ACOMPANHAMENTO", merchantId: pedidoRemoto().merchant.id, integracaoId: "integracao-sintetica", integracao: { contaId: "singleton", criadoPorId: "autor-sintetico" } } };
const pedido = { id: "pedido-sintetico", versao: 1, status: "RECEBIDO_EXTERNO" };
const tx = {
  $queryRaw: vi.fn(), $executeRaw: vi.fn().mockResolvedValue(0),
  configuracaoLoja: { findUnique: vi.fn().mockResolvedValue({ fusoHorario: "America/Sao_Paulo" }) },
  eventoIfood: { findUniqueOrThrow: vi.fn().mockResolvedValue(evento), update: vi.fn().mockResolvedValue({}) },
  identidadeExternaVenda: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(vinculo), update: vi.fn() },
  produtoVenda: { findMany: vi.fn().mockResolvedValue([]) },
  clienteVenda: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => clientes.get(where.id) ?? null), update: vi.fn() },
  pedidoVenda: { create: vi.fn().mockResolvedValue(pedido), findUniqueOrThrow: vi.fn().mockResolvedValue(pedido) },
  pedidoIfood: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "pedido-ifood", pedidoId: pedido.id, estadoRemoto: "PLACED", acompanhamento: true }), update: vi.fn().mockResolvedValue({}) },
  acaoIfood: { findMany: vi.fn().mockResolvedValue([]) }, historicoPedidoVenda: { create: vi.fn().mockResolvedValue({}) },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IFOOD_ATIVO", "1");
  clientes.clear();
  tx.$queryRaw.mockResolvedValue([{ id: evento.id }]);
  sim.requisicao.mockResolvedValue({ dados: pedidoRemoto() });
  sim.transaction.mockImplementation(async callback => callback(tx));
});
afterEach(() => vi.unstubAllEnvs());

it("identidade externa de alias vincula o pedido à raiz sem substituir o snapshot ou a fonte", async () => {
  clientes.set("alias-ifood", { id: "alias-ifood", unificadoEmId: "alias-intermediario" });
  clientes.set("alias-intermediario", { id: "alias-intermediario", unificadoEmId: "cliente-raiz" });
  clientes.set("cliente-raiz", { id: "cliente-raiz", unificadoEmId: null });
  const fonteAntes = structuredClone(vinculo);
  expect(await processarEvento()).toBe(true);
  expect(tx.pedidoVenda.create).toHaveBeenCalledOnce();
  const criado = tx.pedidoVenda.create.mock.calls[0][0].data;
  expect(criado.clienteId).toBe("cliente-raiz");
  expect(criado.compradorSnapshot).toMatchObject({ nome: "Cliente de teste" });
  expect(vinculo).toEqual(fonteAntes);
  expect(tx.clienteVenda.update).not.toHaveBeenCalled();
  expect(tx.identidadeExternaVenda.update).not.toHaveBeenCalled();
  expect(tx.clienteVenda.findUnique.mock.calls.map(([entrada]) => entrada.where.id)).toEqual(["alias-ifood", "alias-intermediario", "cliente-raiz"]);
});

it("alias sem raiz disponível conserva pedido sem vínculo e não usa o ID inativo como comprador", async () => {
  clientes.set("alias-ifood", { id: "alias-ifood", unificadoEmId: "raiz-ausente" });
  expect(await processarEvento()).toBe(true);
  expect(tx.pedidoVenda.create).toHaveBeenCalledOnce();
  expect(tx.pedidoVenda.create.mock.calls[0][0].data.clienteId).toBeNull();
  expect(tx.identidadeExternaVenda.update).not.toHaveBeenCalled();
});
