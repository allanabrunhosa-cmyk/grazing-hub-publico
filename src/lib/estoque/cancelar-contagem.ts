import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { registrarMovimentacao } from "./registrarMovimentacao";
import { DecimalEstoque } from "./quantidade";
import { registrarAtividade } from "@/lib/atividades/registro";

export type ConfirmacaoEstornoContagem = { confirmarEstorno: true; motivo: string };
export class ErroContagem extends Error {}

export async function cancelarContagem(contagemId: string, sessao: SessaoAtual, confirmacao?: ConfirmacaoEstornoContagem) {
  if (typeof contagemId !== "string" || !contagemId.trim()) throw new ErroContagem("Selecione uma contagem.");
  return prisma.$transaction(async tx => {
    // Compartilhada com a gestão de acessos: revogação e cancelamento têm ordem definida.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
    const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
    if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroContagem("Sua sessão foi encerrada. Entre novamente.");
    const admin = usuario.perfilAcesso?.sistema === "ADMINISTRADOR";
    if (!admin && !permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, usuario.permissoesPersonalizadas as Excecoes, "inventario.contagem", "excluir")) throw new ErroContagem("Seu acesso não permite excluir contagens.");
    await tx.$queryRaw`SELECT id FROM "InventarioContagem" WHERE id = ${contagemId} FOR UPDATE`;
    const contagem = await tx.inventarioContagem.findUnique({ where: { id: contagemId }, include: { itens: { include: { movimentoAjuste: true }, orderBy: { insumoId: "asc" } } } });
    if (!contagem) throw new ErroContagem("Contagem não encontrada.");
    if (contagem.status === "EXCLUIDO") throw new ErroContagem("Esta contagem já foi excluída. Nenhum novo estorno foi aplicado.");
    const finalizada = contagem.status === "FINALIZADO";
    const motivo = typeof confirmacao?.motivo === "string" ? confirmacao.motivo.trim() : "";
    if (finalizada && !admin) throw new ErroContagem("Somente administradores podem cancelar contagens finalizadas.");
    if (finalizada && (confirmacao?.confirmarEstorno !== true || motivo.length < 3 || motivo.length > 1000)) throw new ErroContagem("Confirme o estorno dos ajustes e informe o motivo com 3 a 1.000 caracteres.");
    if (!finalizada && confirmacao) throw new ErroContagem("A situação da contagem mudou. Atualize a página antes de confirmar.");

    if (finalizada) {
      // Versões antigas gravavam apenas a observação. Só aceitamos correspondência
      // completa e única; um histórico incompleto/duplicado nunca gera estorno parcial.
      const movimentos = await tx.movimentacaoEstoque.findMany({ where: { OR: [
        { observacao: `Ajuste de contagem ${contagem.id}` },
        { id: { in: contagem.itens.flatMap(i => i.movimentoAjusteId ? [i.movimentoAjusteId] : []) } },
      ] } });
      const utilizados = new Set<string>();
      for (const item of contagem.itens) {
        const delta = new DecimalEstoque(item.quantidadeContada).minus(item.quantidadeSistema);
        if (!item.ajustado) {
          if (item.movimentoAjusteId || (item.contado && !delta.isZero())) throw new ErroContagem("O histórico dos ajustes está incompleto. Revise esta contagem antes de cancelar.");
          continue;
        }
        const candidatos = movimentos.filter(m => m.localId === contagem.localId && m.insumoId === item.insumoId &&
          m.tipo === (delta.isPositive() ? "AJUSTE_ENTRADA" : "AJUSTE_SAIDA") && m.quantidade.equals(delta.abs()) &&
          (!item.movimentoAjusteId || m.id === item.movimentoAjusteId));
        const original = candidatos[0];
        if (!item.contado || delta.isZero() || candidatos.length !== 1 || utilizados.has(original.id) || item.movimentoEstornoId) throw new ErroContagem("Não foi possível identificar os ajustes originais com segurança. Revise o histórico da contagem.");
        utilizados.add(original.id);
        await tx.$queryRaw`SELECT id FROM "Insumo" WHERE id = ${item.insumoId} FOR UPDATE`;
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: item.insumoId }, select: { unidade: true } });
        if (item.unidadeAjuste && item.unidadeAjuste !== insumo.unidade) throw new ErroContagem("A unidade de um insumo mudou desde a contagem. Revise a unidade antes de cancelar.");
        // Soma o inverso do movimento original; nunca restaura o saldo fotografado.
        // Cadastros antigos sem unidade gravada mantêm a mesma quantidade numérica
        // das movimentações e saldos existentes (edição da unidade não os converte).
        const estorno = await registrarMovimentacao({ insumoId: item.insumoId, localId: contagem.localId,
          tipo: original.tipo === "AJUSTE_ENTRADA" ? "AJUSTE_SAIDA" : "AJUSTE_ENTRADA", quantidade: Number(original.quantidade),
          observacao: `Estorno de contagem ${contagem.id} · ajuste ${original.id} · ${motivo}`, criadoPorId: usuario.id, tx });
        await tx.inventarioItem.update({ where: { id: item.id }, data: { movimentoAjusteId: original.id, movimentoEstornoId: estorno.movimentacaoId } });
      }
      if (utilizados.size !== movimentos.length) throw new ErroContagem("Há ajustes adicionais no histórico desta contagem. Revise-os antes de cancelar.");
    }
    await tx.inventarioContagem.update({ where: { id: contagemId }, data: {
      status: "EXCLUIDO", excluidaEm: new Date(), excluidaPorId: usuario.id, excluidaPorNome: usuario.nome,
      motivoExclusao: finalizada ? motivo : null, ajustesEstornados: finalizada,
    } });
    await registrarAtividade(tx, { userId: usuario.id, nome: usuario.nome }, { modulo: "estoque", recurso: "inventario.contagem",
      acao: finalizada ? "CONTAGEM_CANCELADA_COM_ESTORNO" : "CONTAGEM_EXCLUIDA", entidade: "InventarioContagem", entidadeId: contagemId,
      resumo: finalizada ? "Contagem cancelada e ajustes estornados." : "Contagem excluída com histórico preservado.",
      categoria: "CRITICA", deduplicacao: `contagem-excluida:${contagemId}`, antes: { status: contagem.status }, depois: { status: "EXCLUIDO", ajustes: finalizada ? contagem.itens.filter(item => item.ajustado).length : 0 } });
  }, { timeout: 30_000, maxWait: 10_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
