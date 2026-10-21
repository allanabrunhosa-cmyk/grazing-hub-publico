"use server";
import { registrarAtividade } from "@/lib/atividades/registro";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { baixarLancamento } from "@/lib/financeiro/baixarLancamento";
import { exigirDespesaSemCustoEntrega } from "@/lib/financeiro/custos-entrega";
import { somarFrequencia, type FrequenciaRecorrencia } from "@/lib/financeiro/recorrencia";
import type { TipoLancamento } from "@/generated/prisma/client";
import { filtroGrupoLancamento, type EscopoExclusaoLancamento, type ResumoExclusaoLancamento } from "@/lib/financeiro/exclusaoLancamento";
import { paraCaixaAlta, paraCaixaAltaOpcional } from "@/lib/caixa-alta";
import { origemCompraLancamento, prepararCancelamentoCompra, executarCancelamentoCompra } from "@/lib/financeiro/cancelamento-compra";
import type { ConfirmacaoCancelamentoCompra } from "@/lib/financeiro/cancelamento-compra-tipos";

import { dataLancamentoValida } from "@/lib/financeiro/data-lancamento";

export type ResultadoLancamento = { erro: string } | { ok: true; ids?: string[] };

const NENHUM = "__nenhum__";

function optionalId(value: FormDataEntryValue | null) {
  const texto = String(value ?? "").trim();
  return texto === "" || texto === NENHUM ? null : texto;
}

function revalidarTudo() {
  revalidatePath("/inventario");
  revalidatePath("/inventario/movimentacoes");
  revalidatePath("/notas-fiscais");
  revalidatePath("/financeiro/movimentacoes");
  revalidatePath("/financeiro/lancamentos");
  revalidatePath("/financeiro/contas");
  revalidatePath("/financeiro/bancario");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/financeiro");
}

export async function criarLancamentoAction(_prevState: unknown, formData: FormData): Promise<ResultadoLancamento> {
  await exigirPermissao("financeiro.movimentacoes", "adicionar");
  const tipo = String(formData.get("tipo") ?? "") as TipoLancamento;
  const descricao = paraCaixaAlta(String(formData.get("descricao") ?? ""));
  const valor = Number.parseFloat(String(formData.get("valor") ?? "").replace(",", "."));
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const dataCompetenciaStr = String(formData.get("dataCompetencia") ?? "");
  const dataVencimentoStr = String(formData.get("dataVencimento") ?? "");
  const fornecedorId = optionalId(formData.get("fornecedorId"));
  const contraparteNome = paraCaixaAltaOpcional(optionalId(formData.get("contraparteNome")));
  const formaPagamentoId = optionalId(formData.get("formaPagamentoId"));
  const observacoes = optionalId(formData.get("observacoes"));
  const jaBaixado = formData.get("jaBaixado") === "on";
  if (jaBaixado) await exigirPermissao("financeiro.baixas", "editar");
  const contaBancariaId = optionalId(formData.get("contaBancariaId"));
  const dataPagamentoStr = String(formData.get("dataPagamento") ?? "");
  const frequencia = (String(formData.get("frequencia") ?? "MENSAL") as FrequenciaRecorrencia) || "MENSAL";
  const parcelasVencimento = formData.getAll("parcelaVencimento").map(String);

  if (tipo !== "RECEITA" && tipo !== "DESPESA") return { erro: "Escolha se é receita ou despesa." };
  if (!descricao) return { erro: "Descreva o lançamento." };
  if (!Number.isFinite(valor) || valor <= 0) return { erro: "Informe um valor maior que zero." };
  if (!categoriaId) return { erro: "Escolha a categoria." };
  if (!dataLancamentoValida(dataCompetenciaStr)) return { erro: "Competência inválida. Informe dia, mês e ano completos, entre 2000 e 2200." };
  if (dataVencimentoStr && !dataLancamentoValida(dataVencimentoStr)) return { erro: "Vencimento inválido. Informe dia, mês e ano completos, entre 2000 e 2200." };
  if (jaBaixado && !contaBancariaId) return { erro: "Escolha a conta bancária pra registrar a baixa." };
  if (jaBaixado && dataPagamentoStr && !dataLancamentoValida(dataPagamentoStr)) return { erro: "Pagamento inválido. Informe dia, mês e ano completos, entre 2000 e 2200." };

  if (parcelasVencimento.some(d => !dataLancamentoValida(d))) return { erro: "Há uma parcela com vencimento inválido. Informe dia, mês e ano completos, entre 2000 e 2200." };

  const dataCompetenciaBase = new Date(`${dataCompetenciaStr}T12:00:00`);
  const dataVencimentoBase = dataVencimentoStr ? new Date(`${dataVencimentoStr}T12:00:00`) : dataCompetenciaBase;
  const dataPagamento = jaBaixado ? (dataPagamentoStr ? new Date(`${dataPagamentoStr}T12:00:00`) : new Date()) : null;

  // As datas de vencimento vêm prontas do client (parcelasVencimento) — reflete o ajuste
  // fino que o usuário pode ter feito parcela a parcela. A competência de cada parcela
  // sempre segue a cadência regular da frequência escolhida, independente desse ajuste.
  const vencimentos = jaBaixado || parcelasVencimento.length === 0 ? [dataVencimentoBase] : parcelasVencimento.map((d) => new Date(`${d}T12:00:00`));
  const totalParcelas = vencimentos.length;

  if (Array.from({ length: totalParcelas }, (_, i) => somarFrequencia(dataCompetenciaBase, frequencia, i)).some(d => !dataLancamentoValida(d.toISOString().slice(0, 10)))) return { erro: "A recorrência ultrapassa o limite de datas permitido (2000 a 2200)." };

  const session = await getSession();
  if (!session) return { erro: "Sua sessão expirou. Entre novamente." };
  const recorrenciaGrupoId = totalParcelas > 1 ? randomUUID() : null;
  const ids: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (let parcela = 0; parcela < totalParcelas; parcela++) {
        const lancamento = await tx.lancamentoFinanceiro.create({
          data: {
            tipo,
            descricao: totalParcelas > 1 ? `${descricao} (${parcela + 1}/${totalParcelas})` : descricao,
            valor,
            categoriaId,
            dataCompetencia: somarFrequencia(dataCompetenciaBase, frequencia, parcela),
            dataVencimento: vencimentos[parcela],
            fornecedorId,
            contraparteNome,
            formaPagamentoId,
            observacoes,
            recorrenciaGrupoId,
            criadoPorId: session?.userId ?? null,
          },
        });
        ids.push(lancamento.id);
        await registrarAtividade(tx, session, { modulo: "financeiro", recurso: "financeiro.movimentacoes", acao: "CRIACAO", entidade: "LancamentoFinanceiro",
          entidadeId: lancamento.id, resumo: "Lançamento financeiro criado.", categoria: "CRITICA", correlacaoId: recorrenciaGrupoId ?? undefined,
          depois: { tipo, valor: lancamento.valor.toString(), dataCompetencia: lancamento.dataCompetencia, dataVencimento: lancamento.dataVencimento, status: lancamento.status } });

        if (jaBaixado && contaBancariaId) {
          await baixarLancamento({ lancamentoId: lancamento.id, contaBancariaId, dataPagamento: dataPagamento ?? undefined, tx });
        }
      }
    });
  } catch {
    return { erro: "Não foi possível salvar o lançamento." };
  }

  revalidarTudo();
  return { ok: true, ids };
}

export async function atualizarLancamentoAction(lancamentoId: string, formData: FormData): Promise<ResultadoLancamento> {
  const autorEdicao = await exigirPermissao("financeiro.movimentacoes", "editar");
  const atual = await prisma.lancamentoFinanceiro.findUnique({ where: { id: lancamentoId } });
  if (!atual) return { erro: "Lançamento não encontrado." };
  if (atual.itemFaturaId) return { erro: "Desvincule o item em Cartões e Faturas antes de editar a despesa." };
  if (atual.pedidoVendaId) return { erro: "Título vinculado a Pedido deve ser alterado pelo Pedido." };
  if (atual.status !== "PENDENTE") return { erro: "Só é possível editar um lançamento que ainda está pendente." };

  const tipo = String(formData.get("tipo") ?? "") as TipoLancamento;
  const descricao = paraCaixaAlta(String(formData.get("descricao") ?? ""));
  const valor = Number.parseFloat(String(formData.get("valor") ?? "").replace(",", "."));
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const dataCompetenciaStr = String(formData.get("dataCompetencia") ?? "");
  const dataVencimentoStr = String(formData.get("dataVencimento") ?? "");
  const fornecedorId = optionalId(formData.get("fornecedorId"));
  const contraparteNome = paraCaixaAltaOpcional(optionalId(formData.get("contraparteNome")));
  const formaPagamentoId = optionalId(formData.get("formaPagamentoId"));
  const observacoes = optionalId(formData.get("observacoes"));

  if (tipo !== "RECEITA" && tipo !== "DESPESA") return { erro: "Escolha se é receita ou despesa." };
  if (!descricao) return { erro: "Descreva o lançamento." };
  if (!Number.isFinite(valor) || valor <= 0) return { erro: "Informe um valor maior que zero." };
  if (!categoriaId) return { erro: "Escolha a categoria." };
  if (!dataLancamentoValida(dataCompetenciaStr)) return { erro: "Competência inválida. Informe dia, mês e ano completos, entre 2000 e 2200." };
  if (dataVencimentoStr && !dataLancamentoValida(dataVencimentoStr)) return { erro: "Vencimento inválido. Informe dia, mês e ano completos, entre 2000 e 2200." };

  const dataCompetencia = new Date(`${dataCompetenciaStr}T12:00:00`);
  const dataVencimento = dataVencimentoStr ? new Date(`${dataVencimentoStr}T12:00:00`) : dataCompetencia;

  try {
    const alteracao = await prisma.$transaction(async tx => {
      await exigirDespesaSemCustoEntrega(tx, { id: lancamentoId });
      await tx.$queryRaw`SELECT id FROM "LancamentoFinanceiro" WHERE id = ${lancamentoId} FOR UPDATE`;
      const antesEdicao = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: lancamentoId } });
      const resultado = await tx.lancamentoFinanceiro.updateMany({
      where: { id: lancamentoId, status: "PENDENTE", itemFaturaId: null, pedidoVendaId: null },
      data: { tipo, descricao, valor, categoriaId, dataCompetencia, dataVencimento, fornecedorId, contraparteNome, formaPagamentoId, observacoes },
      });
      if (resultado.count === 1) await registrarAtividade(tx, autorEdicao, { modulo: "financeiro", recurso: "financeiro.movimentacoes", acao: "EDICAO", entidade: "LancamentoFinanceiro", entidadeId: lancamentoId,
        resumo: "Lançamento financeiro alterado.", categoria: "CRITICA",
        antes: { tipo: antesEdicao.tipo, valor: antesEdicao.valor.toString(), dataCompetencia: antesEdicao.dataCompetencia, dataVencimento: antesEdicao.dataVencimento, categoriaId: antesEdicao.categoriaId },
        depois: { tipo, valor: String(valor), dataCompetencia, dataVencimento, categoriaId } });
      return resultado;
    });
    if (alteracao.count !== 1) return { erro: "O lançamento foi realizado ou alterado. Atualize a tela antes de editar." };
  } catch (erro) {
    return { erro: erro instanceof Error && erro.message.startsWith("Desvincule o custo") ? erro.message : "Não foi possível salvar as alterações." };
  }

  revalidarTudo();
  return { ok: true };
}

export async function obterResumoExclusaoLancamentoAction(lancamentoId: string): Promise<ResumoExclusaoLancamento | { erro: string }> {
  await exigirPermissao("financeiro.movimentacoes", "visualizar");
  if (!await getSession()) return { erro: "Sua sessão expirou. Entre novamente." };
  try {
    const lancamento = await prisma.lancamentoFinanceiro.findUnique({
      where: { id: lancamentoId }, include: { notaFiscalItemLancamento: { select: { notaFiscalItemId: true } } },
    });
    if (!lancamento) return { erro: "Lançamento não encontrado." };
    if (lancamento.status !== "PENDENTE") return { erro: "Só é possível excluir uma movimentação pendente. Cancele a baixa antes de excluir uma realizada." };
    if (lancamento.pedidoVendaId) return { erro: "Título vinculado a Pedido deve ser alterado pelo Pedido." };
    const sessao = await getSession();
    if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
    const compra = await prisma.$transaction(async tx => {
      const origem = await origemCompraLancamento(tx, lancamentoId);
      return origem ? (await prepararCancelamentoCompra(tx, origem, sessao)).resumo : null;
    });
    if (compra) return { descricao: compra.descricao, grupo: null, pendentes: compra.quantidadeLancamentos, realizados: 0, compra };
    const { grupo, filtro } = filtroGrupoLancamento(lancamento);
    if (!filtro) return { descricao: lancamento.descricao, grupo, pendentes: 1, realizados: 0 };
    const [pendentes, realizados] = await Promise.all([
      prisma.lancamentoFinanceiro.count({ where: { ...filtro, status: "PENDENTE" } }),
      prisma.lancamentoFinanceiro.count({ where: { ...filtro, status: "BAIXADO" } }),
    ]);
    return { descricao: lancamento.descricao, grupo, pendentes, realizados };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível consultar as parcelas. Tente novamente." };
  }
}

export async function excluirLancamentoAction(lancamentoId: string, escopo?: EscopoExclusaoLancamento, confirmacaoCompra?: ConfirmacaoCancelamentoCompra): Promise<{ erro: string } | { ok: true; quantidade: number }> {
  await exigirPermissao("financeiro.movimentacoes", "excluir");
  const sessaoExclusao = await getSession();
  if (!sessaoExclusao) return { erro: "Sua sessão expirou. Entre novamente." };
  if (escopo !== undefined && escopo !== "APENAS_ESTA" && escopo !== "GRUPO_PENDENTE" && escopo !== "COMPRA_INTEGRAL") return { erro: "Escolha quais movimentações deseja excluir." };
  try {
    const quantidade = await prisma.$transaction(async (tx) => {
      const lancamento = await tx.lancamentoFinanceiro.findUnique({
        where: { id: lancamentoId }, include: { notaFiscalItemLancamento: { select: { notaFiscalItemId: true } } },
      });
      if (!lancamento) throw new Error("Lançamento não encontrado.");
      const origem = await origemCompraLancamento(tx, lancamentoId);
      if (origem) {
        if (escopo !== "COMPRA_INTEGRAL" || !confirmacaoCompra) throw new Error("Confirme o cancelamento da compra inteira e a reversão dos itens de estoque.");
        const sessao = await getSession();
        if (!sessao) throw new Error("Sua sessão expirou. Entre novamente.");
        return (await executarCancelamentoCompra(tx, origem, confirmacaoCompra, sessao)).quantidade;
      }
      if (escopo === "COMPRA_INTEGRAL") throw new Error("Esta despesa não tem uma compra integrada.");
      if (lancamento.pedidoVendaId) throw new Error("Título vinculado a Pedido deve ser alterado pelo Pedido.");
      if (lancamento.status !== "PENDENTE") throw new Error("Só é possível excluir uma movimentação pendente. Cancele a baixa antes de excluir uma realizada.");
      const { filtro } = filtroGrupoLancamento(lancamento);
      await exigirDespesaSemCustoEntrega(tx, escopo === "GRUPO_PENDENTE" && filtro ? { ...filtro, status: "PENDENTE" } : { id: lancamentoId });
      if (lancamento.itemFaturaId || (filtro && escopo === "GRUPO_PENDENTE" && await tx.lancamentoFinanceiro.count({ where: { ...filtro, itemFaturaId: { not: null }, status: "PENDENTE" } }))) throw new Error("O grupo contém despesas de faturas. Desvincule-as em Cartões e Faturas antes de excluir.");
      if (filtro && !escopo) throw new Error("Escolha se deseja excluir apenas esta movimentação ou todas as pendentes do grupo.");
      if (!filtro && escopo === "GRUPO_PENDENTE") throw new Error("Esta movimentação não pertence a um grupo de parcelas ou recorrências.");
      const selecionada = await tx.lancamentoFinanceiro.updateMany({
        where: { id: lancamentoId, status: "PENDENTE", itemFaturaId: null, pedidoVendaId: null }, data: { status: "CANCELADO" },
      });
      if (selecionada.count !== 1) throw new Error("A movimentação mudou. Atualize a tela antes de excluir.");
      const auditar = async (quantidade: number) => {
        await tx.historicoAcesso.create({ data: {
          autorId: sessaoExclusao.userId, entidade: "LANCAMENTO_FINANCEIRO", entidadeId: lancamentoId, acao: "CANCELAMENTO",
          antes: { status: lancamento.status, descricao: lancamento.descricao, valor: lancamento.valor.toString(),
            dataCompetencia: lancamento.dataCompetencia.toISOString(), dataVencimento: lancamento.dataVencimento.toISOString() },
          depois: { status: "CANCELADO", escopo: escopo ?? "APENAS_ESTA", quantidade, recorrenciaGrupoId: lancamento.recorrenciaGrupoId, notaFiscalItemId: lancamento.notaFiscalItemLancamento?.notaFiscalItemId ?? null },
        } });
        return quantidade;
      };
      if (escopo !== "GRUPO_PENDENTE" || !filtro) return auditar(1);
      const outras = await tx.lancamentoFinanceiro.updateMany({
        where: { ...filtro, status: "PENDENTE", itemFaturaId: null, pedidoVendaId: null, id: { not: lancamentoId } }, data: { status: "CANCELADO" },
      });
      if (await tx.lancamentoFinanceiro.count({where:{...filtro,itemFaturaId:{not:null},status:"PENDENTE"}})) throw new Error("O grupo foi vinculado a uma fatura. Nenhuma exclusão foi aplicada; atualize a tela.");
      return auditar(1 + outras.count);
    });
    revalidarTudo();
    return { ok: true, quantidade };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível excluir as movimentações." };
  }
}
