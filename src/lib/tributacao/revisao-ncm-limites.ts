import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { lerAjustesOpcoes, limitesEfetivos, opcoesEfetivas } from "@/lib/vendas/dominio";
import type { LimitesEscolha } from "./revisao-ncm-dominio";

/** Limite de escolhas que o cardápio aplica hoje ao grupo neste produto, pela mesma regra
 * do pedido (`limitesEfetivos` em vendas/dominio): EXTRAS não limita; o vínculo pode usar o
 * padrão do grupo ou valores próprios. Vínculo ou grupo inativo/ausente não gera aviso. */
export async function limitesEfetivosGrupo(tx: Prisma.TransactionClient, produtoId: string, grupoId: string): Promise<{ nome: string; limites: LimitesEscolha } | null> {
  const vinculo = await tx.produtoGrupoVenda.findUnique({ where: { produtoId_grupoId: { produtoId, grupoId } }, select: { usarPadrao: true, minimo: true, maximo: true, grupo: { select: { nome: true, tipo: true, minimo: true, maximo: true, ativo: true } } } });
  if (!vinculo || !vinculo.grupo.ativo) return null;
  return { nome: vinculo.grupo.nome, limites: limitesEfetivos(vinculo.grupo, { grupoId, usarPadrao: vinculo.usarPadrao, minimo: vinculo.minimo, maximo: vinculo.maximo }) };
}

/** Opções que o cardápio oferece hoje neste grupo para o produto (ativas no grupo e não
 * pausadas nem excluídas no vínculo), para achar sabores criados depois da análise fiscal. */
export async function opcoesAtivasGrupo(tx: Prisma.TransactionClient, produtoId: string, grupoId: string): Promise<{ id: string; nome: string }[]> {
  const vinculo = await tx.produtoGrupoVenda.findUnique({ where: { produtoId_grupoId: { produtoId, grupoId } }, select: { opcoesExcluidas: true, ajustesOpcoes: true, grupo: { select: { ativo: true, opcoes: { where: { ativo: true }, select: { id: true, nome: true, preco: true, ativo: true }, orderBy: { nome: "asc" } } } } } });
  if (!vinculo || !vinculo.grupo.ativo) return [];
  return opcoesEfetivas(vinculo.grupo.opcoes.map(o => ({ ...o, preco: o.preco.toString() })), { opcoesExcluidas: vinculo.opcoesExcluidas, ajustesOpcoes: lerAjustesOpcoes(vinculo.ajustesOpcoes) }).filter(o => o.ativo).map(o => ({ id: o.id, nome: o.nome }));
}
