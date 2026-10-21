"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import type { PorcaoInsumoOption, SalvarPorcaoInput } from "@/lib/insumos/porcoes";
import { consultarPorcoes, ErroPorcao, recursoConsultaPorcoes, removerPorcao, salvarPorcao, reordenarCategoriasPorcoes } from "@/lib/insumos/porcoes-servidor";
import type { CategoriaPorcoesOption, OrdemCategoriaPorcoesInput } from "@/lib/insumos/ordem-categorias-porcoes";

export async function reordenarCategoriasPorcoesAction(entrada: OrdemCategoriaPorcoesInput[]): Promise<{ categorias: CategoriaPorcoesOption[] } | { erro: string }> {
  const sessao = await exigirPermissao("suprimentos.porcoes", "editar");
  try {
    const categorias = await reordenarCategoriasPorcoes(entrada, sessao);
    revalidatePath("/porcoes");
    return { categorias };
  } catch (erro) { return { erro: erro instanceof ErroPorcao ? erro.message : "Não foi possível ordenar as categorias. Tente novamente." }; }
}

export async function listarPorcoesAction(insumoId: string): Promise<{ porcoes: PorcaoInsumoOption[]; podeCadastrar: boolean } | { erro: string }> {
  const sessao = await exigirPermissao(await recursoConsultaPorcoes(), "visualizar");
  try { return await consultarPorcoes(insumoId, sessao); }
  catch (erro) { return { erro: erro instanceof ErroPorcao ? erro.message : "Não foi possível consultar as porções." }; }
}

export async function salvarPorcaoAction(entrada: SalvarPorcaoInput): Promise<{ sucesso: true; porcao: PorcaoInsumoOption } | { erro: string }> {
  const sessao = await exigirPermissao("suprimentos.porcoes", entrada?.id ? "editar" : "adicionar");
  try {
    const porcao = await salvarPorcao(entrada, sessao);
    revalidatePath("/porcoes");
    return { sucesso: true, porcao };
  } catch (erro) { return { erro: erro instanceof ErroPorcao ? erro.message : "Não foi possível salvar a porção. Atualize a página e tente novamente." }; }
}

export async function removerPorcaoAction(entrada: { id: string; versao: number }): Promise<{ sucesso: true } | { erro: string }> {
  const sessao = await exigirPermissao("suprimentos.porcoes", "excluir");
  try {
    await removerPorcao(entrada, sessao);
    revalidatePath("/porcoes");
    return { sucesso: true };
  } catch (erro) { return { erro: erro instanceof ErroPorcao ? erro.message : "Não foi possível remover a porção." }; }
}
