import type { Prisma } from "@/generated/prisma/client";
export async function travarCustosEntrega(tx: Prisma.TransactionClient) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('financeiro-custos-entrega'))`; }
export async function exigirDespesaSemCustoEntrega(tx: Prisma.TransactionClient, where: Prisma.LancamentoFinanceiroWhereInput) {
  await travarCustosEntrega(tx);
  if (await tx.lancamentoFinanceiro.count({ where: { ...where, custosEntrega: { some: { desvinculadoEm: null } } } })) throw new Error("Desvincule o custo no Pedido antes de alterar ou cancelar esta despesa. Pagamento e conciliação permanecem disponíveis.");
}
