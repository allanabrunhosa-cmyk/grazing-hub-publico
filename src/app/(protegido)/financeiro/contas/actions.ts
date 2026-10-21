"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { baixarLancamento, estornarBaixaLancamento } from "@/lib/financeiro/baixarLancamento";
import { dataLancamentoValida } from "@/lib/financeiro/data-lancamento";

export type ResultadoBaixa = { erro: string } | { ok: true };

function revalidarTudo() {
  revalidatePath("/financeiro/movimentacoes");
  revalidatePath("/financeiro/contas");
  revalidatePath("/financeiro/lancamentos");
  revalidatePath("/financeiro/bancario");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/financeiro");
}

export async function baixarLancamentoAction(
  lancamentoId: string,
  contaBancariaId: string,
  dataPagamento: string
): Promise<ResultadoBaixa> {
  await exigirPermissao("financeiro.baixas", "editar");
  if (!contaBancariaId) return { erro: "Escolha a conta bancária." };
  if (!dataLancamentoValida(dataPagamento)) return { erro: "Informe uma data válida para a transação." };

  try {
    await baixarLancamento({
      lancamentoId,
      contaBancariaId,
      dataPagamento: new Date(`${dataPagamento}T12:00:00`),
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível baixar este lançamento." };
  }

  revalidarTudo();
  return { ok: true };
}

// Reabre um lançamento baixado (volta pra PENDENTE e apaga a movimentação bancária
// gerada) — é o único caminho pra depois poder editar ou excluir um lançamento que já
// tinha sido baixado, evitando corrigir erro de lançamento direto no extrato.
export async function estornarBaixaLancamentoAction(lancamentoId: string): Promise<ResultadoBaixa> {
  const sessao = await exigirPermissao("financeiro.estornos", "editar");
  try {
    await estornarBaixaLancamento({
      lancamentoId,
      desconciliacao: {
        sessao,
        motivo: "Baixa cancelada pelo usuário.",
      },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível cancelar a baixa deste lançamento." };
  }

  revalidarTudo();
  return { ok: true };
}
