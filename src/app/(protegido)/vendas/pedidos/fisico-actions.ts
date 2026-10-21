"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { executarFisicoPedido, type ComandoFisico } from "@/lib/vendas/pedidos-fisico";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";

export async function executarFisicoPedidoAction(id: string, versao: number, comando: ComandoFisico, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.revisar", "editar");
  await exigirPermissao("inventario", "editar");
  try {
    const r = await executarFisicoPedido(id, versao, comando, chave, sessao);
    revalidatePath(`/vendas/pedidos/${id}/operacao`); revalidatePath("/inventario"); revalidatePath("/vendas/pedidos");
    return { ok: true as const, ...r };
  } catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível registrar. Confira o histórico antes de repetir." }; }
}
