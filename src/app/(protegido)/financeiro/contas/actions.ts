"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { baixarLancamento, estornarBaixaLancamento } from "@/lib/financeiro/baixarLancamento";
import { dataLancamentoValida } from "@/lib/financeiro/data-lancamento";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { registrarRecebimentoPedido } from "@/lib/vendas/pedidos";
import { taxaRecebimentoPix } from "@/lib/vendas/pedidos-taxa-recebimento";

export type ResultadoBaixa = { erro: string } | { ok: true };

function revalidarTudo() {
  revalidatePath("/financeiro/movimentacoes");
  revalidatePath("/financeiro/contas");
  revalidatePath("/financeiro/lancamentos");
  revalidatePath("/financeiro/bancario");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/financeiro");
}

/**
 * Categoria da taxa quando a baixa parte de Movimentações: repete a última usada em
 * taxas de pedidos; na falta, a categoria ativa de despesas financeiras que cite "taxa".
 */
async function categoriaPadraoTaxaPedido(): Promise<string | null> {
  const anterior = await prisma.lancamentoFinanceiro.findFirst({
    where: { pedidoEfeitoChave: { startsWith: "taxa-recebimento:" }, categoria: { ativo: true, excluidoEm: null, grupo: "DESPESAS_FINANCEIRAS" } },
    orderBy: { createdAt: "desc" }, select: { categoriaId: true },
  });
  if (anterior) return anterior.categoriaId;
  const categorias = await prisma.categoriaFinanceira.findMany({ where: { ativo: true, excluidoEm: null, grupo: "DESPESAS_FINANCEIRAS" }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  return (categorias.find(c => /taxa/i.test(c.nome)) ?? (categorias.length === 1 ? categorias[0] : undefined))?.id ?? null;
}

export async function baixarLancamentoAction(
  lancamentoId: string,
  contaBancariaId: string,
  dataPagamento: string
): Promise<ResultadoBaixa> {
  await exigirPermissao("financeiro.baixas", "editar");
  if (!contaBancariaId) return { erro: "Escolha a conta bancária." };
  const sessao = await exigirPermissao("financeiro.baixas", "editar");
  if (!dataLancamentoValida(dataPagamento)) return { erro: "Informe uma data válida para a transação." };

  try {
    // Receita de pedido: a baixa é o recebimento integral do título, com os mesmos efeitos
    // de registrá-lo no Pedido. A taxa, quando houver, nasce como despesa pendente.
    const titulo = await prisma.lancamentoFinanceiro.findUnique({ where: { id: lancamentoId }, select: { pedidoVendaId: true, tipo: true, valor: true, pedidoFormaSnapshot: true } });
    if (titulo?.pedidoVendaId && titulo.tipo === "RECEITA") {
      const valor = titulo.valor.toFixed(2);
      const categoriaTaxa = Number(taxaRecebimentoPix(titulo.pedidoFormaSnapshot, valor)) > 0 ? await categoriaPadraoTaxaPedido() : null;
      if (Number(taxaRecebimentoPix(titulo.pedidoFormaSnapshot, valor)) > 0 && !categoriaTaxa) return { erro: "Esta forma de pagamento tem taxa. Registre o recebimento no pedido para escolher a categoria da taxa." };
      await registrarRecebimentoPedido(titulo.pedidoVendaId, lancamentoId, valor, contaBancariaId, dataPagamento, `mov-${randomUUID()}`, sessao, categoriaTaxa ?? undefined);
      revalidarTudo();
      revalidatePath("/vendas/pedidos", "layout");
      return { ok: true };
    }
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
