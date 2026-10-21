"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { MotivoPerda } from "@/generated/prisma/client";
import { DecimalEstoque } from "@/lib/estoque/quantidade";

export type ResultadoPerda = { erro: string } | { perdaId: string; movimentacaoId: string };

class ErroPerda extends Error {}

function atualizarInventario() {
  revalidatePath("/inventario");
  revalidatePath("/inventario/perdas");
  revalidatePath("/inventario/movimentacoes");
}

export async function registrarPerdaAction(input: {
  insumoId: string;
  localId: string;
  motivo: MotivoPerda;
  categoriaPerdaId?: string | null;
  motivoPersonalizado?: string | null;
  quantidade: number;
  /** Campo legado: o valor agora é sempre calculado pelo custo médio do insumo. */
  valorEstimado?: number | null;
  observacao: string | null;
  data: string;
}): Promise<ResultadoPerda> {
  await exigirPermissao("inventario.perdas", "adicionar");
  if (!input || typeof input.insumoId !== "string" || !input.insumoId.trim()) return { erro: "Selecione um insumo." };
  if (typeof input.localId !== "string" || !input.localId.trim()) return { erro: "Selecione um local de estoque." };
  if (!Object.values(MotivoPerda).includes(input.motivo)) return { erro: "Selecione um motivo válido." };
  const motivoPersonalizado = typeof input.motivoPersonalizado === "string" ? input.motivoPersonalizado.trim() : "";
  if (input.motivo === "OUTRO" && !input.categoriaPerdaId && (motivoPersonalizado.length < 3 || motivoPersonalizado.length > 500)) {
    return { erro: "Descreva o motivo da perda com 3 a 500 caracteres." };
  }
  if (typeof input.quantidade !== "number" || !Number.isFinite(input.quantidade) || input.quantidade <= 0) {
    return { erro: "Informe uma quantidade maior que zero." };
  }
  if (input.quantidade > 999999999.999) return { erro: "A quantidade excede o limite de 999.999.999,999." };
  if (input.observacao != null && (typeof input.observacao !== "string" || input.observacao.length > 2000)) {
    return { erro: "A observação deve ter até 2.000 caracteres." };
  }
  const data = new Date(`${input.data}T12:00:00-03:00`);
  if (typeof input.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.data) ||
      !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== input.data) return { erro: "Data inválida." };

  try {
    const sessao = await getSession();
    if (!sessao) return { erro: "Entre novamente para registrar a perda." };
    const resultado = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, select: { id: true, nome: true, ativo: true } });
      if (!usuario?.ativo) throw new ErroPerda("Seu usuário não tem acesso para registrar perdas.");
      await tx.$queryRaw`SELECT id FROM "Insumo" WHERE id = ${input.insumoId} FOR UPDATE`;
      const [insumo, local, categoria] = await Promise.all([
        tx.insumo.findUnique({ where: { id: input.insumoId }, select: { unidade: true, ativo: true, custoMedio: true } }),
        tx.localEstoque.findUnique({ where: { id: input.localId }, select: { ativo: true } }),
        tx.categoriaPerda.findUnique({ where: input.categoriaPerdaId ? { id: input.categoriaPerdaId } : { codigoLegado: input.motivo }, select: { id: true, nome: true, ativo: true, codigoLegado: true } }),
      ]);
      if (!insumo?.ativo || !local?.ativo) throw new ErroPerda("Selecione um insumo e um local de estoque ativos.");
      if (!categoria?.ativo) throw new ErroPerda("Selecione uma categoria de perda ativa.");
      const motivo = categoria?.codigoLegado ?? (categoria ? MotivoPerda.OUTRO : input.motivo);
      const descricao = categoria && !categoria.codigoLegado ? categoria.nome : motivo === MotivoPerda.OUTRO ? motivoPersonalizado : null;
      if (motivo === MotivoPerda.OUTRO && (!descricao || descricao.length < 3 || descricao.length > 500)) throw new ErroPerda("Descreva o motivo da perda com 3 a 500 caracteres.");
      // O valor da perda é sempre a quantidade pelo custo médio vigente no momento
      // do lançamento. O valor enviado pelo cliente é legado e não é utilizado.
      const valorEstimado = new DecimalEstoque(input.quantidade)
        .mul(insumo.custoMedio)
        .toDecimalPlaces(2);
      const perda = await tx.perda.create({ data: {
        insumoId: input.insumoId, localId: input.localId, motivo,
        motivoPersonalizado: motivo === MotivoPerda.OUTRO ? descricao : null,
        categoriaPerdaId: categoria.id,
        unidade: insumo.unidade, quantidade: new DecimalEstoque(input.quantidade), valorEstimado,
        observacao: input.observacao?.trim() || null, data,
        responsavelId: usuario.id, responsavelNome: usuario.nome,
      } });
      const movimentacao = await registrarMovimentacao({
        insumoId: input.insumoId, localId: input.localId, tipo: "SAIDA_PERDA", quantidade: input.quantidade,
        observacao: input.observacao?.trim() || null, criadoPorId: usuario.id, origemPerdaId: perda.id, data, tx,
      });
      return { perdaId: perda.id, movimentacaoId: movimentacao.movimentacaoId };
    });
    atualizarInventario();
    return resultado;
  } catch (erro) {
    return { erro: erro instanceof ErroPerda ? erro.message : "Não foi possível registrar a perda." };
  }
}

export async function excluirPerdaAction(input: { perdaId: string; motivo: string }): Promise<{ erro: string } | { ok: true }> {
  await exigirPermissao("inventario.perdas", "excluir");
  if (!input || typeof input.perdaId !== "string" || !input.perdaId.trim()) return { erro: "Selecione o registro de perda." };
  const motivo = typeof input.motivo === "string" ? input.motivo.trim() : "";
  if (motivo.length < 3 || motivo.length > 1000) return { erro: "Informe o motivo da exclusão com 3 a 1.000 caracteres." };
  try {
    const sessao = await getSession();
    if (!sessao) return { erro: "Entre novamente para excluir a perda." };
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, select: { id: true, nome: true, ativo: true } });
      if (!usuario?.ativo) throw new ErroPerda("Seu usuário não tem acesso para excluir perdas.");
      // Uma segunda confirmação aguarda a primeira e não devolve estoque duas vezes.
      await tx.$queryRaw`SELECT id FROM "Perda" WHERE id = ${input.perdaId} FOR UPDATE`;
      const perda = await tx.perda.findUnique({ where: { id: input.perdaId }, include: { movimentacao: true } });
      if (!perda) throw new ErroPerda("Registro de perda não encontrado.");
      if (perda.excluidaEm) throw new ErroPerda("Este registro de perda já foi excluído.");
      await tx.$queryRaw`SELECT id FROM "Insumo" WHERE id = ${perda.insumoId} FOR UPDATE`;
      const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: perda.insumoId }, select: { unidade: true } });
      if (insumo.unidade !== perda.unidade) throw new ErroPerda("A unidade do insumo mudou desde a perda. Peça ao administrador para revisar a unidade antes de excluir.");
      const saida = perda.movimentacao;
      if (!saida || saida.tipo !== "SAIDA_PERDA" || saida.insumoId !== perda.insumoId || saida.localId !== perda.localId || !saida.quantidade.equals(perda.quantidade) || !perda.quantidade.greaterThan(0)) {
        throw new ErroPerda("A movimentação original da perda precisa ser revisada pelo administrador antes da exclusão.");
      }
      const excluidaEm = new Date();
      const estorno = await registrarMovimentacao({
        insumoId: perda.insumoId, localId: perda.localId, tipo: "AJUSTE_ENTRADA", quantidade: Number(perda.quantidade),
        // A justificativa e a autoria da exclusão ficam somente no histórico restrito.
        observacao: "Reversão de saída de estoque.", data: excluidaEm, tx,
      });
      await tx.perdaExclusao.create({ data: {
        perdaId: perda.id, motivo, responsavelId: usuario.id, responsavelNome: usuario.nome,
        createdAt: excluidaEm, movimentacaoId: estorno.movimentacaoId,
        quantidade: perda.quantidade, unidade: perda.unidade,
      } });
      await tx.perda.update({ where: { id: perda.id }, data: { excluidaEm } });
    });
    atualizarInventario();
    return { ok: true };
  } catch (erro) {
    return { erro: erro instanceof ErroPerda ? erro.message : "Não foi possível excluir a perda. Nenhuma quantidade foi devolvida ao estoque." };
  }
}
