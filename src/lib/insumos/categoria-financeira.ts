import type { Prisma } from "@/generated/prisma/client";
import { GRUPOS_RECEITA } from "@/lib/labels";

export async function resolverCategoriaCompraInsumo(tx: Prisma.TransactionClient, insumoId: string): Promise<{ id: string } | { erro: string }> {
  const insumo = await tx.insumo.findUnique({ where: { id: insumoId }, select: { nome: true, categoriaFinanceiraId: true } });
  if (!insumo) return { erro: "Um dos insumos não existe mais. Selecione novamente." };
  if (insumo.categoriaFinanceiraId) {
    const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: insumo.categoriaFinanceiraId }, select: { id: true, ativo: true, excluidoEm: true, grupo: true } });
    if (!categoria?.ativo || categoria.excluidoEm || GRUPOS_RECEITA.includes(categoria.grupo)) return { erro: `Revise a categoria financeira de ${insumo.nome}: selecione uma categoria de despesa ativa.` };
    return { id: categoria.id };
  }
  // Compatibilidade: insumos ainda não classificados continuam usando o padrão CMV.
  const padrao = await tx.categoriaFinanceira.findFirst({ where: { grupo: "CMV", ativo: true, excluidoEm: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return padrao ? { id: padrao.id } : { erro: "Cadastre uma categoria ativa em CMV ou classifique financeiramente o insumo." };
}
