import { expect, it, vi } from "vitest";
const simulados = vi.hoisted(() => ({ baixar: vi.fn(), revalidar: vi.fn(), titulo: vi.fn(), receber: vi.fn(), taxaAnterior: vi.fn(), categorias: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { lancamentoFinanceiro: { findUnique: simulados.titulo, findFirst: simulados.taxaAnterior }, categoriaFinanceira: { findMany: simulados.categorias } } }));
vi.mock("@/lib/vendas/pedidos", () => ({ registrarRecebimentoPedido: simulados.receber }));
vi.mock("next/cache", () => ({ revalidatePath: simulados.revalidar }));
vi.mock("@/lib/financeiro/baixarLancamento", () => ({ baixarLancamento: simulados.baixar, estornarBaixaLancamento: vi.fn() }));
import { baixarLancamentoAction } from "@/app/(protegido)/financeiro/contas/actions";

it("exige conta e data real antes de registrar a transação", async () => {
  for (const data of ["", "2026-02-30", "invalida"]) expect(await baixarLancamentoAction("id", "conta", data)).toHaveProperty("erro");
  expect(await baixarLancamentoAction("id", "", "2026-09-12")).toHaveProperty("erro");
  expect(simulados.baixar).not.toHaveBeenCalled();
});
it("encaminha a data confirmada e atualiza Movimentações", async () => {
  expect(await baixarLancamentoAction("id", "conta", "2026-09-12")).toEqual({ ok: true });
  expect(simulados.baixar).toHaveBeenCalledWith({ lancamentoId: "id", contaBancariaId: "conta", dataPagamento: new Date("2026-09-12T12:00:00") });
  expect(simulados.revalidar).toHaveBeenCalledWith("/financeiro/movimentacoes");
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue({ userId: "u", nome: "Financeiro fictício" }) }));

it.each(["0206-10-10", "1900-01-01", "1999-12-31"])("bloqueia baixa em ano anterior a 2000: %s", async data => {
  expect(await baixarLancamentoAction("id", "conta", data)).toHaveProperty("erro");
  expect(simulados.baixar).not.toHaveBeenCalled();
});

const valorTitulo = (valor: string) => ({ toFixed: () => valor });
it("receita de pedido é baixada como recebimento integral do pedido, sem baixa genérica", async () => {
  simulados.baixar.mockClear();
  simulados.titulo.mockResolvedValueOnce({ pedidoVendaId: "pedido", tipo: "RECEITA", valor: valorTitulo("150.00"), pedidoFormaSnapshot: { tipo: "DINHEIRO" } });
  expect(await baixarLancamentoAction("titulo", "conta", "2026-09-12")).toEqual({ ok: true });
  expect(simulados.receber).toHaveBeenCalledWith("pedido", "titulo", "150.00", "conta", "2026-09-12", expect.stringMatching(/^mov-[0-9a-f-]{36}$/), { userId: "u", nome: "Financeiro fictício" }, undefined);
  expect(simulados.baixar).not.toHaveBeenCalled();
  expect(simulados.revalidar).toHaveBeenCalledWith("/vendas/pedidos", "layout");
});
it("Pix com taxa usa a categoria da última taxa de pedido e recusa quando não há categoria", async () => {
  simulados.receber.mockClear();
  const pix = { pedidoVendaId: "pedido", tipo: "RECEITA", valor: valorTitulo("100.00"), pedidoFormaSnapshot: { tipo: "PIX", taxaPercentual: "1.00", taxaFixa: "0.00" } };
  simulados.titulo.mockResolvedValueOnce(pix); simulados.taxaAnterior.mockResolvedValueOnce({ categoriaId: "taxas" });
  expect(await baixarLancamentoAction("titulo", "conta", "2026-09-12")).toEqual({ ok: true });
  expect(simulados.receber.mock.calls[0][7]).toBe("taxas");
  simulados.receber.mockClear();
  simulados.titulo.mockResolvedValueOnce(pix); simulados.taxaAnterior.mockResolvedValueOnce(null); simulados.categorias.mockResolvedValueOnce([{ id: "a", nome: "Juros" }, { id: "b", nome: "Multas" }]);
  expect(await baixarLancamentoAction("titulo", "conta", "2026-09-12")).toEqual({ erro: expect.stringContaining("categoria da taxa") });
  expect(simulados.receber).not.toHaveBeenCalled();
});
it("taxa de pedido e lançamento comum seguem a baixa genérica", async () => {
  simulados.baixar.mockClear();
  simulados.titulo.mockResolvedValueOnce({ pedidoVendaId: "pedido", tipo: "DESPESA", valor: valorTitulo("1.00"), pedidoFormaSnapshot: null });
  expect(await baixarLancamentoAction("taxa", "conta", "2026-09-12")).toEqual({ ok: true });
  expect(simulados.baixar).toHaveBeenCalledTimes(1);
});
