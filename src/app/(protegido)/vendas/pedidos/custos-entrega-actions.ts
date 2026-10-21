"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { salvarCustoEntrega, buscarDespesasEntrega, vincularDespesaEntrega, desvincularDespesaEntrega } from "@/lib/vendas/entregas-custos";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
export async function salvarCustoEntregaAction(id: string, versao: number, estimado: string | null, efetivo: string | null, prestador: string | null, motivo: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.logistica", "editar");
  await exigirPermissao("vendas.pedidos");
  try { const r = await salvarCustoEntrega(id, versao, estimado, efetivo, prestador, motivo, chave, sessao); revalidatePath(`/vendas/pedidos/${id}`); return r; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível registrar o custo de entrega." }; }
}
export async function buscarDespesasEntregaAction(busca: string) {
  const sessao = await exigirPermissao("financeiro.movimentacoes", "editar");
  try { return { despesas: await buscarDespesasEntrega(busca, sessao) }; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível buscar as despesas." }; }
}
export async function vincularDespesaEntregaAction(d: Parameters<typeof vincularDespesaEntrega>[0]) {
  const sessao = await exigirPermissao("financeiro.movimentacoes", "editar");
  try { await vincularDespesaEntrega(d, sessao); revalidatePath("/vendas/pedidos", "layout"); return { ok: true as const }; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível vincular. Confira antes de repetir." }; }
}
export async function desvincularDespesaEntregaAction(id: string, motivo: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.movimentacoes", "editar");
  try { await desvincularDespesaEntrega(id, motivo, chave, sessao); revalidatePath("/vendas/pedidos", "layout"); return { ok: true as const }; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível desvincular. Confira antes de repetir." }; }
}
