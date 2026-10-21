"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { mudarStatusGestorPedido, salvarMovimentacaoEstoqueGestorPedidos } from "@/lib/vendas/pedidos";
import type { DirecaoStatusGestor } from "@/lib/vendas/pedidos-operacao-dominio";

export async function mudarStatusGestorPedidoAction(id: string, versao: number, direcao: DirecaoStatusGestor, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos");
  try {
    const salvo = await mudarStatusGestorPedido(id, versao, direcao, chave, sessao);
    revalidatePath("/vendas/pedidos");
    revalidatePath("/vendas/pedidos/calendario");
    revalidatePath("/vendas/pedidos/producao");
    revalidatePath("/vendas/pedidos/gestao");
    revalidatePath(`/vendas/pedidos/${id}`);
    revalidatePath(`/vendas/pedidos/${id}/operacao`);
    revalidatePath("/inventario");
    revalidatePath("/inventario/movimentacoes");
    return { ok: true as const, ...salvo };
  } catch (erro) {
    return { erro: erro instanceof ErroPedidoVenda ? erro.message : "Não foi possível confirmar a etapa. Confira o pedido antes de tentar novamente." };
  }
}

export async function salvarMovimentacaoEstoqueGestorPedidosAction(movimentarEstoque: boolean, versao: number, chave: string, localMovimentarEstoqueId?: string | null) {
  const sessao = await exigirPermissao("vendas.pedidos");
  try {
    const salvo = await salvarMovimentacaoEstoqueGestorPedidos(movimentarEstoque, versao, chave, sessao, localMovimentarEstoqueId);
    revalidatePath("/vendas/pedidos", "layout");
    return { ok: true as const, ...salvo };
  } catch (erro) {
    return { erro: erro instanceof ErroPedidoVenda ? erro.message : "Não foi possível salvar a configuração de estoque. Reabra antes de tentar novamente." };
  }
}
