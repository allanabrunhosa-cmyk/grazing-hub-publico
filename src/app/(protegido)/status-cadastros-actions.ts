"use server";

import { exigirPermissao } from "@/lib/permissoes/servidor";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { registrarAtividade } from "@/lib/atividades/registro";

async function alterar(tipo: "fornecedor" | "insumo", id: string, ativo: boolean): Promise<{ erro: string } | { ok: true }> {
  const sessao = await getSession();
  if (!sessao || !(await prisma.usuario.findFirst({ where: { id: sessao.userId, ativo: true }, select: { id: true } }))) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (typeof id !== "string" || !id.trim() || typeof ativo !== "boolean") return { erro: "Informe um cadastro e um status válidos." };
  try {
    const resultado = await prisma.$transaction(async tx => {
      if (tipo === "fornecedor") await tx.$queryRaw`SELECT "id" FROM "Fornecedor" WHERE "id" = ${id} FOR UPDATE`;
      else await tx.$queryRaw`SELECT "id" FROM "Insumo" WHERE "id" = ${id} FOR UPDATE`;
      const anterior = tipo === "fornecedor"
        ? await tx.fornecedor.findFirst({ where: { id }, select: { ativo: true } })
        : await tx.insumo.findFirst({ where: { id, excluidoEm: null }, select: { ativo: true } });
      const alteracao = tipo === "fornecedor"
        ? await tx.fornecedor.updateMany({ where: { id }, data: { ativo } })
        : await tx.insumo.updateMany({ where: { id, excluidoEm: null }, data: { ativo } });
      if (alteracao.count === 1 && anterior && anterior.ativo !== ativo) await registrarAtividade(tx, sessao, {
        modulo: tipo === "fornecedor" ? "cadastros" : "insumos", recurso: tipo === "fornecedor" ? "fornecedores" : "insumos",
        acao: ativo ? "ATIVACAO" : "INATIVACAO", entidade: tipo === "fornecedor" ? "Fornecedor" : "Insumo", entidadeId: id,
        resumo: ativo ? "Cadastro ativado." : "Cadastro inativado.", antes: { ativo: anterior.ativo }, depois: { ativo },
      });
      return alteracao;
    });
    if (resultado.count !== 1) return { erro: "Cadastro não encontrado. Atualize a página." };
  } catch { return { erro: "Não foi possível atualizar o status. Tente novamente." }; }
  for (const rota of ["/fornecedores", "/insumos", "/compras", "/notas-fiscais"]) revalidatePath(rota);
  revalidatePath("/inventario", "layout");
  revalidatePath("/financeiro", "layout");
  return { ok: true };
}

export async function alterarStatusFornecedorAction(id: string, ativo: boolean) {
  await exigirPermissao("fornecedores", "editar");
  return alterar("fornecedor", id, ativo);
}

export async function alterarStatusInsumoAction(id: string, ativo: boolean) {
  await exigirPermissao("insumos", "editar");
  return alterar("insumo", id, ativo);
}
