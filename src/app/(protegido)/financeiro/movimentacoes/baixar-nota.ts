"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { baixarLancamento } from "@/lib/financeiro/baixarLancamento";
import { dataLancamentoValida } from "@/lib/financeiro/data-lancamento";
import { Prisma } from "@/generated/prisma/client";

// Uma confirmação para os itens exibidos na mesma nota/dia; qualquer conflito desfaz tudo.
export async function baixarNotaFiscalAction(ids: string[], contaBancariaId: string, dataPagamento: string, valorEsperado: number): Promise<{ ok: true } | { erro: string }> {
  await exigirPermissao("financeiro.baixas", "editar");
  if (!(await getSession())) return { erro: "Sessão expirada. Entre novamente." };
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 1000 || ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) return { erro: "Seleção de lançamentos inválida." };
  if (!contaBancariaId || !dataLancamentoValida(dataPagamento) || !Number.isFinite(valorEsperado)) return { erro: "Informe uma conta, uma data e um valor válidos." };
  try {
    await prisma.$transaction(async (tx) => {
      const conta = await tx.contaBancaria.findUnique({ where: { id: contaBancariaId } });
      if (!conta?.ativo) throw new Error("Escolha uma conta bancária ativa.");
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`);
      const registros = await tx.lancamentoFinanceiro.findMany({
        where: { id: { in: ids } },
        include: { notaFiscalItemLancamento: { select: {
          notaFiscalDuplicata: { select: { id: true, valor: true } },
          notaFiscalItem: { select: { notaFiscalId: true } },
        } } },
      });
      const primeiro = registros[0];
      const vinculoPrimeiro = primeiro?.notaFiscalItemLancamento;
      const notaId = vinculoPrimeiro?.notaFiscalItem.notaFiscalId;
      const duplicataId = vinculoPrimeiro?.notaFiscalDuplicata.id;
      const dia = primeiro?.dataVencimento.toISOString().slice(0, 10);
      if (!primeiro || !vinculoPrimeiro || !notaId || !duplicataId || registros.length !== ids.length || registros.some((l) => l.status !== "PENDENTE" || l.tipo !== primeiro.tipo || l.dataVencimento.toISOString().slice(0, 10) !== dia || l.notaFiscalItemLancamento?.notaFiscalItem.notaFiscalId !== notaId || l.notaFiscalItemLancamento?.notaFiscalDuplicata.id !== duplicataId)) {
        throw new Error("Os lançamentos da nota mudaram. Atualize a tela antes de confirmar.");
      }
      const totalCentavos = registros.reduce((total, l) => total + Math.round(Number(l.valor) * 100) * (l.tipo === "DESPESA" ? -1 : 1), 0);
      const valorFinalCentavos = Math.round(Number(vinculoPrimeiro.notaFiscalDuplicata.valor) * 100) * (primeiro.tipo === "DESPESA" ? -1 : 1);
      if (valorFinalCentavos !== Math.round(valorEsperado * 100)) throw new Error("O valor final da parcela mudou. Atualize a tela antes de confirmar.");
      if (totalCentavos !== valorFinalCentavos) throw new Error("A composição dos itens não fecha com o valor final da parcela. Revise a nota fiscal antes de confirmar.");
      const atuais = await tx.lancamentoFinanceiro.findMany({ where: {
        status: "PENDENTE", tipo: primeiro.tipo,
        notaFiscalItemLancamento: { notaFiscalDuplicataId: duplicataId },
      }, select: { id: true } });
      if (atuais.length !== ids.length || atuais.some((l) => !ids.includes(l.id))) throw new Error("Os lançamentos da nota mudaram. Atualize a tela antes de confirmar.");
      for (const id of [...ids].sort()) await baixarLancamento({ lancamentoId: id, contaBancariaId, dataPagamento: new Date(`${dataPagamento}T12:00:00`), tx });
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível realizar esta nota." };
  }
  for (const caminho of ["/financeiro/movimentacoes", "/financeiro/contas", "/financeiro/lancamentos", "/financeiro/bancario", "/financeiro/fluxo-de-caixa", "/financeiro"]) revalidatePath(caminho);
  return { ok: true };
}
