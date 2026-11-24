"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { cancelarCobrancaAsaas, gerarCobrancaAsaas, pixCobrancaAsaas } from "@/lib/asaas/cobrancas";
import { ErroAsaas } from "@/lib/asaas/dominio";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";

const falha = (e: unknown) => ({ erro: e instanceof ErroAsaas || e instanceof ErroPedidoVenda ? e.message : "Não foi possível concluir. Confira a cobrança e tente novamente." });

/** A permissão de confirmar pedidos é relida dentro da transação do serviço. */
export async function gerarCobrancaAsaasAction(pedidoId: string, entrada: { forma: string; vencimento: string }, operacao: string) {
  const sessao = await exigirPermissao("vendas.pedidos");
  try { const cobranca = await gerarCobrancaAsaas(pedidoId, entrada, operacao, sessao); revalidatePath("/vendas/pedidos"); return { ok: true as const, cobranca }; } catch (e) { return falha(e); }
}
export async function cancelarCobrancaAsaasAction(cobrancaId: string) {
  const sessao = await exigirPermissao("vendas.pedidos");
  try { const cobranca = await cancelarCobrancaAsaas(cobrancaId, sessao); revalidatePath("/vendas/pedidos"); return { ok: true as const, cobranca }; } catch (e) { return falha(e); }
}
export async function pixCobrancaAsaasAction(cobrancaId: string) {
  const sessao = await exigirPermissao("vendas.pedidos");
  try { return { ok: true as const, pix: await pixCobrancaAsaas(cobrancaId, sessao) }; } catch (e) { return falha(e); }
}
