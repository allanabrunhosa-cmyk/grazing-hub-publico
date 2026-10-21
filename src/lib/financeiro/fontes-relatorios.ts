import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { caminhoCategoria, SELECAO_CATEGORIA_COM_CAMINHO } from "./caminho-categoria";
import { valoresCompetenciaPedidos } from "./competencia-pedidos";
import type { LancamentoParaDre } from "./calcularDre";
import type { LancamentoRow } from "@/app/(protegido)/financeiro/types";

export async function carregarFonteDre(db: Pick<Prisma.TransactionClient, "lancamentoFinanceiro"> = prisma, take?: number) {
  const lancamentos = await db.lancamentoFinanceiro.findMany({ where: { status: { not: "CANCELADO" } }, take,
    select: { id: true, contaBancariaId: true, tipo: true, pedidoEfeitoChave: true,
      pedidoVenda: { select: { id: true, versaoFinanceiro: true, status: true, total: true, entregueEm: true, tratamentosFinanceiros: { select: { status: true, valor: true, retido: true, reduzVenda: true } }, movimentosCreditoAplicado: { select: { tipo: true, valor: true, reduzVenda: true } } } },
      valor: true, status: true, dataCompetencia: true, dataPagamento: true, itemFaturaId: true, pedidoQuitadoCredito: true,
      liquidacoesCartao: { where: { pagamento: { revertidoEm: null } }, select: { valor: true, pagamento: { select: { data: true, contaIdOriginal: true } } } },
      categoria: { select: SELECAO_CATEGORIA_COM_CAMINHO },
    } });
  // Não projetar competência sobre um grupo de títulos truncado.
  if (take !== undefined && lancamentos.length >= take) return { excedido: true as const, linhas: [] };
  const competencias = valoresCompetenciaPedidos(lancamentos);
  const linhas = lancamentos.map(l => ({
    id: l.id, contaBancariaId: l.contaBancariaId, valor: Number(l.valor), valorCompetencia: competencias.get(l.id),
    status: l.status, dataCompetencia: l.dataCompetencia.toISOString(), dataPagamento: l.dataPagamento?.toISOString() ?? null,
    ...(l.itemFaturaId ? { liquidacoesCartao: l.liquidacoesCartao.map(q => ({ valor: Number(q.valor), data: q.pagamento.data.toISOString(), contaBancariaId: q.pagamento.contaIdOriginal })) } : {}),
    pedidoQuitadoCredito: l.pedidoQuitadoCredito, categoriaId: l.categoria.id, categoriaNome: caminhoCategoria(l.categoria), categoriaGrupo: l.categoria.grupo,
  } satisfies LancamentoParaDre & { id: string; contaBancariaId: string | null }));
  return { excedido: false as const, linhas };
}

export async function carregarFonteFluxo(db: Pick<Prisma.TransactionClient, "lancamentoFinanceiro"> = prisma, take?: number): Promise<LancamentoRow[]> {
  const lancamentos = await db.lancamentoFinanceiro.findMany({
    where: { status: { not: "CANCELADO" } }, take, orderBy: { dataVencimento: "asc" },
    include: { categoria: { select: SELECAO_CATEGORIA_COM_CAMINHO }, fornecedor: { select: { nome: true } }, contaBancaria: { select: { nome: true } }, formaPagamento: { select: { nome: true } } },
  });
  return lancamentos.map(l => ({ id: l.id, tipo: l.tipo, descricao: l.descricao, valor: Number(l.valor), categoriaId: l.categoriaId,
    categoriaNome: caminhoCategoria(l.categoria), categoriaGrupo: l.categoria.grupo, dataCompetencia: l.dataCompetencia.toISOString(),
    dataVencimento: l.dataVencimento.toISOString(), status: l.status, dataPagamento: l.dataPagamento?.toISOString() ?? null,
    pedidoQuitadoCredito: l.pedidoQuitadoCredito, pedidoVendaId: l.pedidoVendaId, contaBancariaId: l.contaBancariaId,
    contaBancariaNome: l.contaBancaria?.nome ?? null, fornecedorId: l.fornecedorId, fornecedorNome: l.fornecedor?.nome ?? null,
    formaPagamentoId: l.formaPagamentoId, formaPagamentoNome: l.formaPagamento?.nome ?? null, contraparteNome: l.contraparteNome, observacoes: l.observacoes }));
}
