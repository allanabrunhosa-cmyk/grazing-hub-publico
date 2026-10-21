"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cancelarContagem, ErroContagem, type ConfirmacaoEstornoContagem } from "@/lib/estoque/cancelar-contagem";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { DecimalEstoque } from "@/lib/estoque/quantidade";
import { registrarAtividade } from "@/lib/atividades/registro";

export type EscopoContagem =
  | { tipo: "TODOS" }
  | { tipo: "ITENS"; insumoIds: string[] }
  | { tipo: "CATEGORIA"; categoriaIds: string[] };

export type ResultadoIniciarContagem = { erro: string } | { contagemId: string };

export async function iniciarContagemAction(localId: string, escopo: EscopoContagem): Promise<ResultadoIniciarContagem> {
  const sessao = await exigirPermissao("inventario.contagem", "adicionar");
  if (!localId) return { erro: "Selecione um local de estoque." };

  const filtroEscopo =
    escopo.tipo === "ITENS"
      ? { id: { in: escopo.insumoIds } }
      : escopo.tipo === "CATEGORIA"
        ? { categoriaId: { in: escopo.categoriaIds } }
        : {};

  if (escopo.tipo === "ITENS" && escopo.insumoIds.length === 0) {
    return { erro: "Selecione pelo menos um insumo." };
  }
  if (escopo.tipo === "CATEGORIA" && escopo.categoriaIds.length === 0) {
    return { erro: "Selecione pelo menos uma categoria." };
  }

  const insumosAtivos = await prisma.insumo.findMany({ where: { ativo: true, ...filtroEscopo }, select: { id: true } });
  if (insumosAtivos.length === 0) {
    return { erro: "Nenhum insumo ativo encontrado para esse critério." };
  }

  const saldos = await prisma.saldoEstoque.findMany({
    where: { localId, insumoId: { in: insumosAtivos.map((i) => i.id) } },
    select: { insumoId: true, quantidadeAtual: true },
  });
  const saldoPorInsumo = new Map(saldos.map((s) => [s.insumoId, s.quantidadeAtual]));

  const contagem = await prisma.$transaction(async tx => {
    const criada = await tx.inventarioContagem.create({
    data: {
      localId,
      responsavelId: sessao.userId,
      itens: {
        create: insumosAtivos.map((insumo) => {
          const quantidadeSistema = saldoPorInsumo.get(insumo.id) ?? 0;
          return {
            insumoId: insumo.id,
            quantidadeSistema,
            quantidadeContada: quantidadeSistema,
            contado: false,
          };
        }),
      },
    },
    });
    await registrarAtividade(tx, sessao, { modulo: "estoque", recurso: "inventario.contagem", acao: "CONTAGEM_INICIADA",
      entidade: "InventarioContagem", entidadeId: criada.id, resumo: "Contagem de estoque iniciada.", depois: { status: "EM_ANDAMENTO", localId, itens: insumosAtivos.length } });
    return criada;
  });

  revalidatePath("/inventario/contagem");
  return { contagemId: contagem.id };
}

export type ResultadoSalvarItem = { erro: string } | { ok: true };

const QUANTIDADE_MAXIMA = 999_999_999.999;

function quantidadeValida(quantidade: number | null) {
  return quantidade === null || (Number.isFinite(quantidade) && quantidade >= 0 && quantidade <= QUANTIDADE_MAXIMA);
}

export async function salvarItemContagemAction(itemId: string, quantidadeContada: number | null): Promise<ResultadoSalvarItem> {
  const sessao = await exigirPermissao("inventario.contagem", "editar");
  if (!quantidadeValida(quantidadeContada)) {
    return { erro: "Quantidade inválida." };
  }

  return prisma.$transaction(async tx => {
    const referencia = await tx.inventarioItem.findUnique({ where: { id: itemId }, select: { contagemId: true } });
    if (!referencia) return { erro: "Item de contagem não encontrado." };
    await tx.$queryRaw`SELECT id FROM "InventarioContagem" WHERE id = ${referencia.contagemId} FOR UPDATE`;
    const contagem = await tx.inventarioContagem.findUnique({ where: { id: referencia.contagemId } });
    if (contagem?.status !== "EM_ANDAMENTO") return { erro: "Esta contagem não está mais em andamento." };
    const anterior = await tx.inventarioItem.findUniqueOrThrow({ where: { id: itemId }, select: { contado: true, quantidadeContada: true } });
    // Sem revalidação por blur para preservar as demais linhas ainda em edição.
    await tx.inventarioItem.update({
      where: { id: itemId },
      data: quantidadeContada === null ? { contado: false } : { quantidadeContada: new DecimalEstoque(quantidadeContada), contado: true },
    });
    const mudou = anterior.contado !== (quantidadeContada !== null)
      || (quantidadeContada !== null && !anterior.quantidadeContada.equals(quantidadeContada));
    if (mudou) await registrarAtividade(tx, sessao, { modulo: "estoque", recurso: "inventario.contagem", acao: "CONTAGEM_ITEM_ALTERADO",
      entidade: "InventarioContagem", entidadeId: referencia.contagemId, resumo: "Quantidade de um item da contagem alterada.",
      antes: { quantidade: anterior.contado ? anterior.quantidadeContada.toString() : null, contado: anterior.contado },
      depois: { quantidade: quantidadeContada === null ? null : new DecimalEstoque(quantidadeContada).toString(), contado: quantidadeContada !== null } });
    return { ok: true as const };
  });
}

export type ResultadoExcluirContagem = { erro: string } | { ok: true };

// Exclusão lógica preserva itens e movimentos; finalizadas exigem administrador e estorno explícito.
export async function excluirContagemAction(contagemId: string, confirmacao?: ConfirmacaoEstornoContagem): Promise<ResultadoExcluirContagem> {
  const sessao = await exigirPermissao("inventario.contagem", "excluir");
  try {
    await cancelarContagem(contagemId, sessao, confirmacao);
    revalidatePath("/inventario/contagem");
    revalidatePath(`/inventario/contagem/${contagemId}`);
    revalidatePath("/inventario");
    revalidatePath("/inventario/movimentacoes");
    return { ok: true };
  } catch (erro) {
    return { erro: erro instanceof ErroContagem ? erro.message : "Não foi possível excluir a contagem. Tente novamente." };
  }
}

export type ResultadoFinalizarContagem = { erro: string } | { ok: true; ajustes: number };

export type ItemContagemParaFinalizar = { id: string; quantidadeContada: number | null };

export async function finalizarContagemAction(
  contagemId: string,
  itensDaTela?: ItemContagemParaFinalizar[],
): Promise<ResultadoFinalizarContagem> {
  const sessao = await exigirPermissao("inventario.contagem", "editar");
  try {
    if (itensDaTela) {
      const ids = new Set(itensDaTela.map((item) => item.id));
      if (itensDaTela.length > 10_000 || ids.size !== itensDaTela.length || itensDaTela.some((item) => !item.id || !quantidadeValida(item.quantidadeContada))) {
        return { erro: "Há quantidades inválidas na contagem. Revise os campos e tente novamente." };
      }
    }

    const ajustes = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventarioContagem" WHERE id = ${contagemId} FOR UPDATE`;
      const contagem = await tx.inventarioContagem.findUniqueOrThrow({
        where: { id: contagemId },
        include: { itens: { orderBy: { insumoId: "asc" } } },
      });
      if (contagem.status === "FINALIZADO") {
        throw new Error("Esta contagem já foi finalizada.");
      }
      if (contagem.status === "EXCLUIDO") {
        throw new Error("Esta contagem foi excluída e não pode mais ser finalizada.");
      }

      const quantidadesDaTela = itensDaTela
        ? new Map(itensDaTela.map((item) => [item.id, item.quantidadeContada]))
        : null;
      if (quantidadesDaTela && (quantidadesDaTela.size !== contagem.itens.length || contagem.itens.some((item) => !quantidadesDaTela.has(item.id)))) {
        throw new Error("A lista de itens mudou. Reabra a contagem antes de finalizar.");
      }

      let total = 0;
      for (const item of contagem.itens) {
        const quantidadeRecebida = quantidadesDaTela?.get(item.id);
        const contado = quantidadesDaTela ? quantidadeRecebida !== null : item.contado;
        const quantidadeContada = quantidadesDaTela
          ? (quantidadeRecebida ?? Number(item.quantidadeSistema))
          : Number(item.quantidadeContada);

        if (!contado) {
          if (quantidadesDaTela) {
            await tx.inventarioItem.update({ where: { id: item.id }, data: { contado: false } });
          }
          continue; // deixado em branco — mantém o saldo do sistema
        }

        const delta = Number(new DecimalEstoque(quantidadeContada).minus(item.quantidadeSistema));
        if (delta === 0) {
          if (quantidadesDaTela) {
            await tx.inventarioItem.update({ where: { id: item.id }, data: { quantidadeContada: new DecimalEstoque(quantidadeContada), contado: true } });
          }
          continue; // contado, mas igual ao sistema — sem ajuste
        }

        await tx.$queryRaw`SELECT id FROM "Insumo" WHERE id = ${item.insumoId} FOR UPDATE`;
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: item.insumoId }, select: { unidade: true } });
        const movimento = await registrarMovimentacao({
          insumoId: item.insumoId,
          localId: contagem.localId,
          tipo: delta > 0 ? "AJUSTE_ENTRADA" : "AJUSTE_SAIDA",
          quantidade: Math.abs(delta),
          observacao: `Ajuste de contagem ${contagem.id}`,
          criadoPorId: sessao.userId,
          tx,
        });
        await tx.inventarioItem.update({
          where: { id: item.id },
          data: {
            ...(quantidadesDaTela ? { quantidadeContada: new DecimalEstoque(quantidadeContada), contado: true } : {}),
            ajustado: true,
            movimentoAjusteId: movimento.movimentacaoId,
            unidadeAjuste: insumo.unidade,
          },
        });
        total++;
      }

      await tx.inventarioContagem.update({ where: { id: contagemId }, data: { status: "FINALIZADO", finalizadaEm: new Date() } });
      await registrarAtividade(tx, sessao, { modulo: "estoque", recurso: "inventario.contagem", acao: "CONTAGEM_FINALIZADA",
        entidade: "InventarioContagem", entidadeId: contagemId, resumo: "Contagem de estoque finalizada e ajustes registrados.",
        categoria: "CRITICA", deduplicacao: `contagem-finalizada:${contagemId}`, antes: { status: contagem.status }, depois: { status: "FINALIZADO", ajustes: total, itens: contagem.itens.length } });
      return total;
    }, { timeout: 30_000, maxWait: 10_000 });

    revalidatePath("/inventario/contagem");
    revalidatePath(`/inventario/contagem/${contagemId}`);
    revalidatePath("/inventario");
    revalidatePath("/inventario/movimentacoes");
    return { ok: true, ajustes };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível finalizar a contagem." };
  }
}
