"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { salvarTipoEmbalagem } from "@/lib/vendas/embalagens";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";

export async function salvarTipoEmbalagemAction(valor: unknown) {
  const sessao = await exigirPermissao("vendas.catalogo", valor && typeof valor === "object" && "id" in valor && valor.id ? "editar" : "adicionar");
  try { return { embalagem: await salvarTipoEmbalagem(valor, sessao) }; }
  catch (erro) { return { erro: erro instanceof ErroPedidoVenda ? erro.message : "Não foi possível salvar o tipo de embalagem." }; }
}
