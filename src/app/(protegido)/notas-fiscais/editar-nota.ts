"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { corrigirNotaNaTransacao, ErroCorrecaoNota, type EntradaCorrecaoNota } from "@/lib/notas-fiscais/correcao-nota";

export async function editarNotaAceitaAction(input: EntradaCorrecaoNota): Promise<{ erro: string } | { ok: true }> {
  await exigirPermissao("notas", "visualizar");
  await exigirPermissao("notas.manifestar", "editar");
  const sessao = await getSession();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
  try {
    await prisma.$transaction(tx => corrigirNotaNaTransacao(tx, input, sessao), { timeout: 30_000, maxWait: 5_000 });
    for (const rota of ["/notas-fiscais", "/financeiro", "/financeiro/movimentacoes", "/financeiro/cartoes", "/financeiro/fluxo-de-caixa", "/inventario", "/inventario/movimentacoes", "/insumos"]) revalidatePath(rota);
    return { ok: true };
  } catch (erro) {
    return { erro: erro instanceof ErroCorrecaoNota ? erro.message : "Não foi possível corrigir a nota. Nenhuma alteração foi aplicada." };
  }
}
