"use server";

import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarResumoPedido } from "@/lib/vendas/consultar-resumo-pedido";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";

export async function consultarResumoPedidoAction(id: string) {
  await exigirPermissao("vendas.pedidos");
  try { return { dados: await consultarResumoPedido(id) }; }
  catch (erro) { return { erro: erro instanceof ErroPedidoVenda ? erro.message : "Não foi possível carregar o resumo. Tente novamente." }; }
}
