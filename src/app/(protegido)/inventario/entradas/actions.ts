"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { consultarEntrada, excluirEntradaAvulsa, corrigirEntradaAvulsa } from "@/lib/estoque/entrada-avulsa-servidor";
import { ErroCorrecaoEntrada, type CorrecaoEntradaInput } from "@/lib/inventario/entrada-avulsa-historico";

export async function corrigirEntradaAvulsaAction(input: CorrecaoEntradaInput): Promise<{ ok: true; id: string } | { erro: string }> {
  const sessao = await exigirPermissao("inventario", "editar");
  try {
    const id = await corrigirEntradaAvulsa(input, sessao);
    for (const rota of ["/inventario", "/inventario/entradas", "/inventario/movimentacoes", "/insumos"]) revalidatePath(rota);
    revalidatePath("/inventario/entradas/[id]", "page");
    return { ok: true, id };
  } catch (erro) { return { erro: erro instanceof ErroCorrecaoEntrada ? erro.message : "Não foi possível corrigir a entrada. Nenhuma alteração foi confirmada." }; }
}

export async function consultarEntradaAvulsaAction(id: string) {
  await exigirPermissao("inventario");
  try {
    const detalhe = await prisma.$transaction(tx => consultarEntrada(tx, id), { isolationLevel: "RepeatableRead" });
    if (!detalhe) return { erro: "Entrada não encontrada." };
    const [insumos, locais] = await Promise.all([
      prisma.insumo.findMany({ where: { excluidoEm: null }, select: { id: true, nome: true, unidade: true }, orderBy: { nome: "asc" } }),
      prisma.localEstoque.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    ]);
    return { detalhe, insumos, locais };
  } catch (erro) { return { erro: erro instanceof ErroCorrecaoEntrada ? erro.message : "Não foi possível consultar a entrada. Tente novamente." }; }
}
export async function excluirEntradaAvulsaAction(input: { id: string; versao: number; chave: string; motivo: string }): Promise<{ ok: true } | { erro: string }> {
  const sessao = await exigirPermissao("inventario", "excluir");
  try {
    await excluirEntradaAvulsa(input, sessao);
    for (const rota of ["/inventario", "/inventario/entradas", "/inventario/movimentacoes", "/insumos", "/financeiro/movimentacoes", "/financeiro/fluxo-de-caixa", "/financeiro"]) revalidatePath(rota);
    revalidatePath("/inventario/entradas/[id]", "page");
    return { ok: true };
  } catch (erro) { return { erro: erro instanceof ErroCorrecaoEntrada ? erro.message : "Não foi possível excluir. Nenhuma alteração foi confirmada." }; }
}
