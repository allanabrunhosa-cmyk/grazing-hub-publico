"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { previaImportacao, aplicarImportacao } from "@/lib/vendas/importacao";
import { mensagemErroCadastro } from "@/lib/vendas/persistencia";

export async function prepararImportacaoVendaAction(conteudo: string) {
  await exigirPermissao("vendas.importacao", "visualizar");
  await exigirPermissao("vendas.produtos", "visualizar");
  await exigirPermissao("vendas.catalogo", "visualizar");
  try { return { previa: await previaImportacao(conteudo) }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function aplicarImportacaoVendaAction(conteudo: string, token: string) {
  const autor = await exigirPermissao("vendas.importacao", "adicionar");
  await exigirPermissao("vendas.produtos", "adicionar");
  await exigirPermissao("vendas.produtos", "editar");
  await exigirPermissao("vendas.catalogo", "adicionar");
  await exigirPermissao("vendas.catalogo", "editar");
  try {
    const resultado = await aplicarImportacao(conteudo, token, autor);
    revalidatePath("/vendas", "layout");
    return { resultado };
  } catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
