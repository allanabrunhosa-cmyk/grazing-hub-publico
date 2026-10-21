"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/permissoes/servidor";

export async function adicionarCategoriaPerdaAction(nomeInformado: string) {
  await exigirPermissao("inventario.perdas.categorias", "adicionar");
  const nome = typeof nomeInformado === "string" ? nomeInformado.trim().replace(/\s+/g, " ") : "";
  if (nome.length < 3 || nome.length > 80) return { erro: "Informe um nome de 3 a 80 caracteres." };
  try {
    const categoria = await prisma.categoriaPerda.create({ data: { nome }, select: { id: true, nome: true, ativo: true, codigoLegado: true } });
    revalidatePath("/inventario/perdas");
    revalidatePath("/inventario");
    return { categoria };
  } catch {
    return { erro: "Não foi possível cadastrar a categoria. Confira se o nome já existe." };
  }
}

export async function alterarCategoriaPerdaAction(id: string, ativo: boolean) {
  await exigirPermissao("inventario.perdas.categorias", "editar");
  if (typeof id !== "string" || !id || typeof ativo !== "boolean") return { erro: "Categoria inválida." };
  try {
    await prisma.categoriaPerda.update({ where: { id }, data: { ativo } });
    revalidatePath("/inventario/perdas");
    revalidatePath("/inventario");
    return { ok: true as const };
  } catch {
    return { erro: "Não foi possível alterar a categoria." };
  }
}

export async function removerCategoriaPerdaAction(id: string) {
  await exigirPermissao("inventario.perdas.categorias", "excluir");
  if (typeof id !== "string" || !id) return { erro: "Categoria inválida." };
  try {
    const removida = await prisma.categoriaPerda.delete({ where: { id, perdas: { none: {} } }, select: { id: true } });
    if (!removida) return { erro: "Não foi possível remover esta categoria." };
    revalidatePath("/inventario/perdas");
    revalidatePath("/inventario");
    return { ok: true as const };
  } catch {
    return { erro: "Esta categoria já foi usada em perdas. Inative-a para preservar o histórico." };
  }
}
