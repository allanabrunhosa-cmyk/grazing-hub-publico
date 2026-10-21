"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { LocalOption } from "@/app/(protegido)/inventario/types";

export async function createLocalAction(nomeInput: string): Promise<LocalOption> {
  await exigirPermissao("inventario", "adicionar");
  const nome = nomeInput.trim();
  if (!nome) throw new Error("Informe um nome para o local.");
  const local = await prisma.localEstoque.upsert({ where: { nome }, update: {}, create: { nome } });
  revalidatePath("/inventario");
  return local;
}

export async function renameLocalAction(id: string, nomeInput: string): Promise<void> {
  await exigirPermissao("inventario", "editar");
  const nome = nomeInput.trim();
  if (!nome) throw new Error("Informe um nome para o local.");
  await prisma.localEstoque.update({ where: { id }, data: { nome } });
  revalidatePath("/inventario");
}

export async function deleteLocalAction(id: string): Promise<{ error: string | null }> {
  await exigirPermissao("inventario", "excluir");
  try {
    await prisma.localEstoque.delete({ where: { id } });
  } catch {
    return { error: "Não foi possível excluir. Verifique se não há estoque ou movimentações neste local." };
  }
  revalidatePath("/inventario");
  return { error: null };
}
