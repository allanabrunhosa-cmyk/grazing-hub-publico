"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ajustarCreditoCliente } from "@/lib/vendas/pedidos";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";

export async function ajustarCreditoClienteAction(clienteId: string, origemId: string, tipo: "AJUSTE_CREDITO" | "AJUSTE_DEBITO", valor: string, motivo: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.movimentacoes", "editar");
  await exigirPermissao("financeiro.baixas", "editar");
  await exigirPermissao("vendas.pedidos.cancelar", "editar");
  try {
    const movimento = await ajustarCreditoCliente(clienteId, origemId, tipo, valor, motivo, chave, sessao);
    revalidatePath("/vendas/clientes");
    revalidatePath("/vendas/pedidos");
    return { ok: true as const, movimento: { id: movimento.id } };
  } catch (erro) {
    return { erro: erro instanceof ErroPedidoVenda ? erro.message : "Não foi possível registrar o ajuste de crédito." };
  }
}
