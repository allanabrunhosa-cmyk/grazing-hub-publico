import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reagendarPedidoAction } from "@/app/(protegido)/compras/reagendar-pedido";
import { salvarPedidoAction, confirmarRecebimentoAction, cancelarPedidoAction, reabrirPedidoAction, excluirPedidoAction } from "@/app/(protegido)/compras/actions";
vi.mock("@/lib/session", () => ({ getSession: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
it("exige sessão em todas as mutações de compra", async () => {
  expect(await reagendarPedidoAction({ pedidoId: "p", previsaoAnterior: null, previsaoEntrega: "2026-09-12" })).toHaveProperty("erro", "Sua sessão expirou. Entre novamente.");
  expect(await excluirPedidoAction("p")).toHaveProperty("erro", "Sua sessão expirou. Entre novamente.");
  expect(await salvarPedidoAction({ fornecedorId: null, previsaoEntrega: null, observacoes: null, itens: [] })).toHaveProperty("erro", "Sua sessão expirou. Entre novamente.");
  expect(await confirmarRecebimentoAction({ pedidoId: "p", responsavel: "Ana", dataRecebimento: "2026-09-10", itens: [] })).toHaveProperty("erro", "Sua sessão expirou. Entre novamente.");
  expect(await cancelarPedidoAction({ pedidoId: "p", responsavel: "Ana", justificativa: "Teste" })).toHaveProperty("erro", "Sua sessão expirou. Entre novamente.");
  expect(await reabrirPedidoAction({ pedidoId: "p", motivo: "Teste" })).toHaveProperty("erro", "Sua sessão expirou. Entre novamente.");
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
