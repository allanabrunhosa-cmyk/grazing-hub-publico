"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { executarOperacaoPedido } from "@/lib/vendas/pedidos";
import type { ComandoOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { executarFisicoPedido, type ComandoFisico } from "@/lib/vendas/pedidos-fisico";

export async function produzirMaterialAction(id: string, versao: number, comando: ComandoFisico, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.producao", "editar");
  await exigirPermissao("inventario", "editar");
  try {
    const r = await executarFisicoPedido(id, versao, comando, chave, sessao);
    revalidatePath("/vendas/pedidos/producao"); revalidatePath("/inventario"); revalidatePath(`/vendas/pedidos/${id}/operacao`);
    return { ok: true as const, ...r };
  } catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível registrar o material. Confira o histórico." }; }
}

export async function produzirPedidoAction(id: string, versao: number, comando: ComandoOperacao, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.producao", "editar");
  if (!["INICIAR", "PREPARAR", "PRONTO", "OCORRENCIA"].includes(comando.tipo)) return { erro: "Ação não disponível à produção." };
  try {
    const r = await executarOperacaoPedido(id, versao, comando, chave, sessao);
    revalidatePath("/vendas/pedidos/producao"); revalidatePath("/vendas/pedidos"); revalidatePath(`/vendas/pedidos/${id}/operacao`);
    return { ok: true as const, ...r };
  } catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível confirmar. Confira o histórico antes de repetir." }; }
}
