"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatarNumeroPedido } from "@/app/(protegido)/compras/types";
import { UnidadeMedida, type TipoDivergencia } from "@/generated/prisma/client";
import { fatorDaUnidade } from "@/lib/insumos/conversoes";
import { registrarAtividade } from "@/lib/atividades/registro";

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
function dataValida(valor: string) {
  return REGEX_DATA.test(valor) && !Number.isNaN(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor;
}

// ============================================================
// Criar / editar pedido
// ============================================================

export type ItemPedidoInput = {
  pedidoItemOriginalId?: string;
  conversao?: { fator: number; unidadePrincipal: UnidadeMedida } | null;
  insumoId: string | null;
  descricao?: string;
  quantidade: number;
  unidadeCompra: UnidadeMedida;
  precoUnitario: number | null;
};

export type ResultadoSalvarPedido = { erro: string } | { ok: true; pedidoId: string };

export async function salvarPedidoAction(input: {
  pedidoId?: string;
  fornecedorId: string | null;
  fornecedorAvulso?: string | null;
  usoConsumo?: boolean;
  previsaoEntrega: string | null;
  observacoes: string | null;
  itens: ItemPedidoInput[];
}): Promise<ResultadoSalvarPedido> {
  await exigirPermissao("compras", input.pedidoId ? "editar" : "adicionar");
  const session = await getSession();
  if (!session) return { erro: "Sua sessão expirou. Entre novamente." };
  const usoConsumo = input.usoConsumo === true;
  const fornecedorAvulso = !input.fornecedorId ? input.fornecedorAvulso?.trim() || null : null;
  if (!input.fornecedorId && !fornecedorAvulso) return { erro: "Selecione um fornecedor ou informe o nome do fornecedor não cadastrado." };
  if (fornecedorAvulso && fornecedorAvulso.length > 200) return { erro: "O fornecedor deve ter até 200 caracteres." };
  if (input.itens.length === 0) return { erro: "Adicione pelo menos um item ao pedido." };
  for (const item of input.itens) {
    if (usoConsumo ? !item.descricao?.trim() : !item.insumoId) return { erro: usoConsumo ? "Descreva cada item de uso e consumo." : "Selecione o insumo de cada item." };
    if ((item.descricao?.length ?? 0) > 300) return { erro: "A descrição deve ter até 300 caracteres." };
    if (!Object.values(UnidadeMedida).includes(item.unidadeCompra)) return { erro: "Unidade de compra inválida." };
    if (item.conversao && (usoConsumo || !Object.values(UnidadeMedida).includes(item.conversao.unidadePrincipal) || !Number.isFinite(item.conversao.fator) || item.conversao.fator <= 0)) {
      return { erro: "Conversão de compra inválida." };
    }
    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) return { erro: "Informe uma quantidade maior que zero em cada item." };
    if (item.precoUnitario != null && (!Number.isFinite(item.precoUnitario) || item.precoUnitario < 0)) {
      return { erro: "Preço unitário inválido." };
    }
  }
  if (input.previsaoEntrega && !dataValida(input.previsaoEntrega)) return { erro: "Data de entrega inválida." };

  const previsaoEntrega = input.previsaoEntrega ? new Date(`${input.previsaoEntrega}T12:00:00`) : null;
  const observacoes = input.observacoes?.trim() || null;

  const itensData = input.itens.map((item) => ({
    insumoId: usoConsumo ? null : item.insumoId,
    descricao: usoConsumo ? item.descricao!.trim() : null,
    quantidade: item.quantidade,
    unidadeCompra: item.unidadeCompra,
    fatorConversao: null as number | null,
    unidadePrincipal: null as UnidadeMedida | null,
    precoUnitario: item.precoUnitario,
    precoTotal: item.precoUnitario != null ? item.precoUnitario * item.quantidade : null,
  }));

  try {
    const pedidoId = await prisma.$transaction(async (tx) => {
      if (input.pedidoId) await tx.$queryRaw`SELECT "id" FROM "PedidoCompra" WHERE "id" = ${input.pedidoId} FOR UPDATE`;
      if (input.fornecedorId && !await tx.fornecedor.findFirst({ where: { id: input.fornecedorId, ativo: true, tipoCadastro: "FORNECEDOR" } })) throw new Error("Fornecedor indisponível.");
      if (!usoConsumo) {
        const ids = [...new Set(input.itens.map(i => i.insumoId!))];
        const quantidade = await tx.insumo.count({ where: { id: { in: ids }, ativo: true } });
        if (quantidade !== ids.length) throw new Error("Há insumos indisponíveis no pedido.");
        // Confere o fator exibido pelo formulário e guarda uma cópia, nunca o valor enviado sem validação.
        for (const [indice, item] of input.itens.entries()) {
          if (!item.conversao) continue;
          if (item.pedidoItemOriginalId) {
            if (!input.pedidoId) throw new Error("O item original deve pertencer ao pedido editado.");
            const original = await tx.pedidoCompraItem.findFirst({ where: { id: item.pedidoItemOriginalId, pedidoId: input.pedidoId, insumoId: item.insumoId, unidadeCompra: item.unidadeCompra, ativo: true } });
            if (!original?.fatorConversao || original.unidadePrincipal !== item.conversao.unidadePrincipal || Number(original.fatorConversao) !== item.conversao.fator) {
              throw new Error("A conversão original do pedido não confere. Atualize a página antes de salvar.");
            }
            itensData[indice].fatorConversao = Number(original.fatorConversao);
            itensData[indice].unidadePrincipal = original.unidadePrincipal;
            continue;
          }
          await tx.$queryRaw`SELECT "id" FROM "Insumo" WHERE "id" = ${item.insumoId} FOR SHARE`;
          const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: item.insumoId! }, select: { unidade: true, conversoes: { select: { unidade: true, fator: true } } } });
          const fator = fatorDaUnidade(item.unidadeCompra, insumo.unidade, insumo.conversoes.map((conversao) => ({ ...conversao, fator: Number(conversao.fator) })));
          if (fator === null || item.conversao.fator !== fator || item.conversao.unidadePrincipal !== insumo.unidade) {
            throw new Error("A conversão deste insumo mudou. Atualize a página e confira o pedido antes de salvar.");
          }
          itensData[indice].fatorConversao = fator;
          itensData[indice].unidadePrincipal = insumo.unidade;
        }
      }
      let pedido;
      let antes: { status: string; dataEntrega: Date | null } | undefined;
      if (input.pedidoId) {
        const existente = await tx.pedidoCompra.findUniqueOrThrow({ where: { id: input.pedidoId } });
        antes = { status: existente.status, dataEntrega: existente.previsaoEntrega };
        if (existente.excluidoEm) throw new Error("Este pedido foi excluído e está disponível somente no histórico.");
        if (existente.status !== "CONFIRMADO") {
          throw new Error("Este pedido já foi recebido ou cancelado — não pode mais ser editado.");
        }
        await tx.pedidoCompraItem.updateMany({ where: { pedidoId: input.pedidoId, ativo: true }, data: { ativo: false } });
        pedido = await tx.pedidoCompra.update({
          where: { id: input.pedidoId },
          data: {
            fornecedorId: input.fornecedorId || null,
            fornecedorAvulso,
            usoConsumo,
            previsaoEntrega,
            observacoes,
            itens: { create: itensData },
          },
        });
      } else {
        pedido = await tx.pedidoCompra.create({
          data: {
            fornecedorId: input.fornecedorId || null,
            fornecedorAvulso,
            usoConsumo,
            previsaoEntrega,
            observacoes,
            status: "CONFIRMADO",
            criadoPorId: session?.userId ?? null,
            itens: { create: itensData },
          },
        });
      }

      // Popula o histórico de Cotação organicamente — sem tela dedicada nesta entrega.
      for (const [indice, item] of input.itens.entries()) {
        if (!usoConsumo && item.insumoId && input.fornecedorId && item.precoUnitario != null && item.precoUnitario > 0 && item.conversao !== null && !item.pedidoItemOriginalId) {
          await tx.cotacao.create({
            data: {
              insumoId: item.insumoId,
              fornecedorId: input.fornecedorId,
              // Cotações sugeridas são por unidade principal, mesmo quando a compra usa embalagem.
              precoUnitario: item.precoUnitario / (itensData[indice].fatorConversao ?? 1),
              observacao: `Pedido ${formatarNumeroPedido(pedido.numero)}`,
            },
          });
        }
      }

      const depois = { status: pedido.status, dataEntrega: pedido.previsaoEntrega };
      await registrarAtividade(tx, session, { modulo: "compras", recurso: "compras", acao: input.pedidoId ? "COMPRA_EDITADA" : "COMPRA_CRIADA",
        entidade: "PedidoCompra", entidadeId: pedido.id, resumo: input.pedidoId ? "Pedido de compra alterado." : "Pedido de compra criado.",
        ...(antes ? { antes: antes.dataEntrega?.getTime() !== depois.dataEntrega?.getTime() ? { dataEntrega: antes.dataEntrega } : {},
          depois: { ...(antes.dataEntrega?.getTime() !== depois.dataEntrega?.getTime() ? { dataEntrega: depois.dataEntrega } : {}), itens: input.itens.length,
            camposAlterados: antes.dataEntrega?.getTime() !== depois.dataEntrega?.getTime() ? "itens, dataEntrega" : "itens" } } : { depois: { ...depois, itens: input.itens.length } }),
      });
      return pedido.id;
    });

    revalidatePath("/compras");
    return { ok: true, pedidoId };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar o pedido." };
  }
}

// ============================================================
// Confirmar recebimento — só registra a chegada, não mexe em estoque
// ============================================================

export type ItemRecebimentoInput = {
  pedidoItemId: string | null; // null = item recebido mas não constava no pedido
  insumoId: string | null;
  quantidadeRecebida: number;
  lote: string | null;
  validade: string | null;
  qualidadeOk: boolean;
};

export type ResultadoRecebimento = { erro: string } | { ok: true; recebimentoId: string };

export async function confirmarRecebimentoAction(input: {
  pedidoId: string;
  responsavel: string;
  dataRecebimento: string;
  itens: ItemRecebimentoInput[];
}): Promise<ResultadoRecebimento> {
  await exigirPermissao("compras.receber", "editar");
  await exigirPermissao("compras", "visualizar");
  const session = await getSession();
  if (!session) return { erro: "Sua sessão expirou. Entre novamente." };
  if (!input.responsavel.trim()) return { erro: "Informe quem recebeu a mercadoria." };
  if (!dataValida(input.dataRecebimento)) return { erro: "Data do recebimento inválida." };
  if (input.itens.length === 0) return { erro: "Nenhum item pra conferir." };
  for (const item of input.itens) {
    if (item.validade && !dataValida(item.validade)) return { erro: "Data de validade inválida." };
    if (!Number.isFinite(item.quantidadeRecebida) || item.quantidadeRecebida < 0) {
      return { erro: "Quantidade recebida inválida." };
    }
  }

  const dataRec = new Date(`${input.dataRecebimento}T12:00:00`);

  try {
    const recebimentoId = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PedidoCompra" WHERE "id" = ${input.pedidoId} FOR UPDATE`;
      const pedido = await tx.pedidoCompra.findUniqueOrThrow({
        where: { id: input.pedidoId },
        include: { itens: { where: { ativo: true } } },
      });
      if (pedido.excluidoEm) throw new Error("Este pedido foi excluído e está disponível somente no histórico.");
      if (pedido.status !== "CONFIRMADO") {
        throw new Error("Este pedido já foi recebido ou cancelado.");
      }

      const ids = input.itens.flatMap(i => i.pedidoItemId ? [i.pedidoItemId] : []);
      if (new Set(ids).size !== ids.length || ids.some(id => !pedido.itens.some(i => i.id === id))) throw new Error("Há itens repetidos ou que não pertencem ao pedido.");
      if (pedido.itens.some(i => i.quantidade.toNumber() > 0 && !ids.includes(i.id))) throw new Error("Confira todos os itens do pedido.");
      if (pedido.usoConsumo && input.itens.some(i => !i.pedidoItemId)) throw new Error("Edite o pedido para incluir outros itens de uso e consumo.");
      const foraDoPrazo = pedido.previsaoEntrega != null && dataRec > pedido.previsaoEntrega;
      const completo = pedido.itens.filter(item => Number(item.quantidade) > 0).every((item) => {
        const linha = input.itens.find((i) => i.pedidoItemId === item.id);
        return linha != null && linha.quantidadeRecebida >= Number(item.quantidade);
      });

      const recebimento = await tx.recebimento.create({
        data: {
          pedidoId: input.pedidoId,
          dataRecebimento: dataRec,
          tipo: completo ? "TOTAL" : "PARCIAL",
          responsavelNome: input.responsavel.trim(),
          responsavelId: session?.userId ?? null,
        },
      });

      for (const linha of input.itens) {
        let pedidoItemId = linha.pedidoItemId;
        let quantidadeOrdenada = 0;
        let ehExtra = false;

        if (pedidoItemId) {
          const original = pedido.itens.find((i) => i.id === pedidoItemId);
          quantidadeOrdenada = original ? Number(original.quantidade) : 0;
        } else {
          ehExtra = true;
          if (!linha.insumoId) throw new Error("Selecione o insumo recebido fora do pedido.");
          const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: linha.insumoId }, select: { unidade: true } });
          const novoItem = await tx.pedidoCompraItem.create({
            data: {
              pedidoId: input.pedidoId,
              insumoId: linha.insumoId,
              quantidade: 0,
              unidadeCompra: insumo.unidade,
              precoUnitario: null,
              precoTotal: null,
            },
          });
          pedidoItemId = novoItem.id;
        }

        const recebimentoItem = await tx.recebimentoItem.create({
          data: {
            recebimentoId: recebimento.id,
            pedidoItemId,
            quantidadeRecebida: linha.quantidadeRecebida,
            lote: linha.lote?.trim() || null,
            validade: linha.validade ? new Date(`${linha.validade}T12:00:00`) : null,
            qualidadeOk: linha.qualidadeOk,
          },
        });

        const divergencias: { tipo: TipoDivergencia; descricao: string | null }[] = [];
        if (ehExtra) {
          divergencias.push({ tipo: "VEIO_ERRADO", descricao: "Item recebido sem constar no pedido original." });
        } else if (linha.quantidadeRecebida < quantidadeOrdenada) {
          divergencias.push({ tipo: "FALTOU", descricao: `Recebido ${linha.quantidadeRecebida} de ${quantidadeOrdenada} pedido(s).` });
        }
        if (!linha.qualidadeOk) divergencias.push({ tipo: "QUALIDADE", descricao: null });
        if (foraDoPrazo) divergencias.push({ tipo: "FORA_DO_PRAZO", descricao: null });

        if (divergencias.length > 0) {
          await tx.recebimentoDivergencia.createMany({
            data: divergencias.map((d) => ({ recebimentoItemId: recebimentoItem.id, tipo: d.tipo, descricao: d.descricao })),
          });
        }
      }

      await tx.pedidoCompra.update({
        where: { id: input.pedidoId },
        data: { status: completo ? "RECEBIDO_TOTAL" : "RECEBIDO_PARCIAL" },
      });

      await tx.pedidoCompraHistorico.create({ data: {
        pedidoId: pedido.id, statusAnterior: pedido.status,
        statusNovo: completo ? "RECEBIDO_TOTAL" : "RECEBIDO_PARCIAL",
        motivo: "Conferência de recebimento registrada.", usuarioId: session.userId, usuarioNome: session.nome,
      } });
      return recebimento.id;
    });

    revalidatePath("/compras");
    return { ok: true, recebimentoId };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível confirmar o recebimento." };
  }
}

// ============================================================
// Cancelar pedido
// ============================================================

export type ResultadoCancelamento = { erro: string } | { ok: true };

export async function cancelarPedidoAction(input: {
  pedidoId: string;
  responsavel: string;
  justificativa: string;
}): Promise<ResultadoCancelamento> {
  await exigirPermissao("compras.cancelar", "editar");
  const session = await getSession();
  if (!session) return { erro: "Sua sessão expirou. Entre novamente." };
  if (!input.responsavel.trim()) return { erro: "Informe o responsável." };
  if (!input.justificativa.trim()) return { erro: "Informe a justificativa." };
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "PedidoCompra" WHERE "id" = ${input.pedidoId} FOR UPDATE`;
      const pedido = await tx.pedidoCompra.findUniqueOrThrow({ where: { id: input.pedidoId } });
      if (pedido.excluidoEm) throw new Error("Este pedido foi excluído e está disponível somente no histórico.");
      if (pedido.status !== "CONFIRMADO") throw new Error("Este pedido já foi recebido ou cancelado.");
      await tx.pedidoCompra.update({ where: { id: pedido.id }, data: { status: "CANCELADO" } });
      await tx.pedidoCompraHistorico.create({ data: {
        pedidoId: pedido.id, statusAnterior: pedido.status, statusNovo: "CANCELADO",
        motivo: input.responsavel.trim() + ": " + input.justificativa.trim(), usuarioId: session.userId, usuarioNome: session.nome,
      } });
    });
    revalidatePath("/compras");
    return { ok: true };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível cancelar o pedido." };
  }
}

export async function reabrirPedidoAction(input: { pedidoId: string; motivo: string }): Promise<{ erro: string } | { ok: true }> {
  await exigirPermissao("compras.reabrir", "editar");
  await exigirPermissao("compras", "visualizar");
  const session = await getSession();
  if (!session) return { erro: "Sua sessão expirou. Entre novamente." };
  const motivo = input.motivo.trim();
  if (motivo.length < 5 || motivo.length > 1000) return { erro: "Informe o motivo da reabertura (5 a 1.000 caracteres)." };
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "PedidoCompra" WHERE "id" = ${input.pedidoId} FOR UPDATE`;
      const pedido = await tx.pedidoCompra.findUniqueOrThrow({ where: { id: input.pedidoId } });
      if (pedido.excluidoEm) throw new Error("Este pedido foi excluído e está disponível somente no histórico.");
      if (pedido.status !== "RECEBIDO_TOTAL" && pedido.status !== "RECEBIDO_PARCIAL") throw new Error("Somente pedidos recebidos podem ser reabertos.");
      await tx.recebimento.updateMany({ where: { pedidoId: pedido.id, reabertoEm: null }, data: { reabertoEm: new Date() } });
      await tx.pedidoCompra.update({ where: { id: pedido.id }, data: { status: "CONFIRMADO" } });
      await tx.pedidoCompraHistorico.create({ data: {
        pedidoId: pedido.id, statusAnterior: pedido.status, statusNovo: "CONFIRMADO",
        motivo, usuarioId: session.userId, usuarioNome: session.nome,
      } });
    });
    revalidatePath("/compras");
    return { ok: true };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível reabrir o pedido." };
  }
}

export async function excluirPedidoAction(pedidoId: string): Promise<{ erro: string } | { ok: true }> {
  await exigirPermissao("compras", "excluir");
  const sessao = await getSession();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
  if (typeof pedidoId !== "string" || !pedidoId.trim()) return { erro: "Pedido inválido." };
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "PedidoCompra" WHERE "id" = ${pedidoId} FOR UPDATE`;
      const pedido = await tx.pedidoCompra.findUniqueOrThrow({ where: { id: pedidoId } });
      if (pedido.excluidoEm) throw new Error("Este pedido já foi excluído.");
      await tx.pedidoCompra.update({ where: { id: pedidoId }, data: { excluidoEm: new Date() } });
      await tx.pedidoCompraHistorico.create({ data: {
        pedidoId, acao: "EXCLUSAO", statusAnterior: pedido.status, statusNovo: pedido.status,
        motivo: "Pedido excluído da lista e do calendário. Histórico preservado.",
        usuarioId: sessao.userId, usuarioNome: sessao.nome,
      } });
    });
    revalidatePath("/compras");
    return { ok: true };
  } catch (erro) { return { erro: erro instanceof Error ? erro.message : "Não foi possível excluir o pedido." }; }
}
