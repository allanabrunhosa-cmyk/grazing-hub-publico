"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { vincularDocumentoExternoPedido } from "@/lib/vendas/pedidos-documento-externo";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
export async function vincularDocumentoExternoPedidoAction(id: string, emissor: string, referencia: string, evidencia: string) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  await exigirPermissao("vendas.pedidos.revisar", "editar");
  try { await vincularDocumentoExternoPedido(id, emissor, referencia, evidencia, sessao); revalidatePath(`/vendas/pedidos/${id}/operacao`); return { ok: true as const }; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível vincular o documento externo." }; }
}
