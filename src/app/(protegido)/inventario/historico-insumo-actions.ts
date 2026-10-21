"use server";

import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { TIPOS_ENTRADA } from "@/lib/estoque/extrato";
import { fimDoDia } from "@/lib/estoque/posicao";
import { montarTrechoMovimentacoes } from "@/lib/estoque/detalhe-movimentacoes";
import type { HistoricoInsumoDetalhe } from "@/app/(protegido)/inventario/types";

const LIMITE_MOVIMENTACOES = 50;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

type EntradaHistorico = {
  insumoId: string;
  localId?: string | null;
  dataReferencia?: string | null;
};

export async function obterMovimentacoesInsumoAction(
  input: EntradaHistorico
): Promise<{ dados: HistoricoInsumoDetalhe } | { erro: string }> {
  await exigirPermissao("inventario");
  if (!input || typeof input.insumoId !== "string" || !input.insumoId.trim()) {
    return { erro: "Selecione um insumo para consultar o histórico." };
  }
  if (input.localId != null && typeof input.localId !== "string") {
    return { erro: "Local de estoque inválido." };
  }
  if (input.dataReferencia != null && !DATA_ISO.test(input.dataReferencia)) {
    return { erro: "Data de referência inválida." };
  }

  try {
    const dataLimite = input.dataReferencia ? fimDoDia(input.dataReferencia) : null;
    const where = {
      insumoId: input.insumoId,
      ...(input.localId ? { localId: input.localId } : {}),
      ...(dataLimite ? { createdAt: { lte: dataLimite } } : {}),
    };

    const consulta = await prisma.$transaction(async (tx) => {
      const insumo = await tx.insumo.findUnique({
        where: { id: input.insumoId },
        select: { id: true, nome: true, especificacao: true, unidade: true },
      });
      const local = input.localId
        ? await tx.localEstoque.findUnique({ where: { id: input.localId }, select: { nome: true } })
        : null;
      const movimentos = await tx.movimentacaoEstoque.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: LIMITE_MOVIMENTACOES + 1,
        select: {
          id: true,
          createdAt: true,
          tipo: true,
          quantidade: true,
          observacao: true,
          local: { select: { nome: true } },
          criadoPor: { select: { nome: true } },
        },
      });

      let saldoReferencia = 0;
      if (dataLimite) {
        const agrupados = await tx.movimentacaoEstoque.groupBy({ by: ["tipo"], where, _sum: { quantidade: true } });
        saldoReferencia = agrupados.reduce((total, linha) => {
          const quantidade = Number(linha._sum.quantidade ?? 0);
          return total + (TIPOS_ENTRADA.includes(linha.tipo) ? quantidade : -quantidade);
        }, 0);
      } else {
        const saldo = await tx.saldoEstoque.aggregate({
          where: { insumoId: input.insumoId, ...(input.localId ? { localId: input.localId } : {}) },
          _sum: { quantidadeAtual: true },
        });
        saldoReferencia = Number(saldo._sum.quantidadeAtual ?? 0);
      }

      return { insumo, local, movimentos, saldoReferencia };
    }, { isolationLevel: "RepeatableRead" });

    if (!consulta.insumo) return { erro: "Insumo não encontrado." };
    if (input.localId && !consulta.local) return { erro: "Local de estoque não encontrado." };

    const trecho = montarTrechoMovimentacoes(
      consulta.movimentos.map((movimento) => ({
        id: movimento.id,
        createdAt: movimento.createdAt.toISOString(),
        tipo: movimento.tipo,
        quantidade: Number(movimento.quantidade),
        localNome: movimento.local.nome,
        observacao: movimento.observacao,
        responsavelNome: movimento.criadoPor?.nome ?? null,
      })),
      consulta.saldoReferencia,
      LIMITE_MOVIMENTACOES
    );

    return {
      dados: {
        insumoId: consulta.insumo.id,
        insumoNome: consulta.insumo.nome,
        insumoEspecificacao: consulta.insumo.especificacao,
        unidade: consulta.insumo.unidade,
        localNome: consulta.local?.nome ?? null,
        dataReferencia: input.dataReferencia ?? null,
        saldoReferencia: consulta.saldoReferencia,
        saldoAnteriorAoTrecho: trecho.saldoAnteriorAoTrecho,
        temMais: trecho.temMais,
        limite: LIMITE_MOVIMENTACOES,
        movimentacoes: trecho.movimentos,
      },
    };
  } catch {
    return { erro: "Não foi possível carregar as movimentações deste insumo." };
  }
}
