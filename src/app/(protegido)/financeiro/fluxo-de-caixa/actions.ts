"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { ErroCaixaFechado, fecharMesCaixa, reabrirMesCaixa } from "@/lib/financeiro/fechamento-caixa";

export type ResultadoFechamento = { erro: string } | { ok: true; fechadoAte: string | null };

function revalidar() {
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/financeiro/movimentacoes");
}

// Somente administradores: a regra é conferida de novo no servidor, dentro da transação.
export async function fecharMesCaixaAction(mes: string): Promise<ResultadoFechamento> {
  const sessao = await exigirPermissao("financeiro.fluxo");
  try {
    const resultado = await prisma.$transaction(tx => fecharMesCaixa(tx, mes, sessao));
    revalidar();
    return { ok: true, fechadoAte: resultado.fechadoAte };
  } catch (erro) {
    return { erro: erro instanceof ErroCaixaFechado ? erro.message : "Não foi possível fechar o mês. Atualize a tela e tente novamente." };
  }
}

export async function reabrirMesCaixaAction(motivo: string): Promise<ResultadoFechamento> {
  const sessao = await exigirPermissao("financeiro.fluxo");
  try {
    const resultado = await prisma.$transaction(tx => reabrirMesCaixa(tx, motivo, sessao));
    revalidar();
    return { ok: true, fechadoAte: resultado.fechadoAte };
  } catch (erro) {
    return { erro: erro instanceof ErroCaixaFechado ? erro.message : "Não foi possível reabrir o mês. Atualize a tela e tente novamente." };
  }
}
