import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroIfood, uuid } from "./dominio";
import { BLOQUEIO_ACOMPANHAMENTO_IFOOD, pedidoEmAcompanhamento, pilotoPreparado, type LojaRecepcaoIfood } from "./acompanhamento-dominio";
import { ehPedidoHistorico } from "@/lib/vendas/historico-dominio";

export function recepcaoPermitida(l: LojaRecepcaoIfood) {
  if (process.env.IFOOD_ATIVO !== "1") return false;
  if (l.modoOperacao === "ACOMPANHAMENTO") return pilotoPreparado(l) &&
    (l.ambiente === "TESTE" || l.ambiente === "PRODUCAO" && process.env.IFOOD_ACOMPANHAMENTO_PRODUCAO_AUTORIZADO === "1" && l.merchantId === process.env.IFOOD_ACOMPANHAMENTO_MERCHANT_ID);
  return l.ambiente === "TESTE" || l.ambiente === "PRODUCAO" && process.env.IFOOD_PRODUCAO_AUTORIZADA === "1";
}
/** Mesmo filtro antes do claim; uma loja bloqueada não ocupa a cabeça da fila. Aliases l/i. */
export function filtroRecepcaoSql() {
  return Prisma.sql`((l."modoOperacao"='OPERACAO' AND (l.ambiente='TESTE' OR (l.ambiente='PRODUCAO' AND ${process.env.IFOOD_PRODUCAO_AUTORIZADA === "1"}))) OR
    (l."modoOperacao"='ACOMPANHAMENTO' AND l."pilotoAte">(now() AT TIME ZONE 'UTC') AND lower(l."principalClientId")<>lower(i."clientId") AND length(l."principalClientId")>0 AND length(l."pilotoEnquadramentoReferencia")>0 AND length(l."pilotoPresencaReferencia")>0 AND
    (l.ambiente='TESTE' OR (l.ambiente='PRODUCAO' AND ${process.env.IFOOD_ACOMPANHAMENTO_PRODUCAO_AUTORIZADO === "1"} AND l."merchantId"=${process.env.IFOOD_ACOMPANHAMENTO_MERCHANT_ID ?? ""}))))`;
}
export async function acompanhamentoDoPedido(tx: Prisma.TransactionClient, pedidoId: string) {
  return pedidoEmAcompanhamento(await tx.pedidoIfood.findUnique({ where: { pedidoId }, select: { acompanhamento: true, loja: { select: { modoOperacao: true } } } }));
}
export async function exigirEfeitoOperacional(tx: Prisma.TransactionClient, pedidoId: string) {
  const pedido = await tx.pedidoVenda.findUnique({ where: { id: pedidoId }, select: { origem: true, referenciaOrigem: true } });
  if (pedido && ehPedidoHistorico(pedido)) throw new ErroIfood("Pedido histórico é somente leitura. Use a importação por lote para corrigir sua fonte.");
  if (await acompanhamentoDoPedido(tx, pedidoId)) throw new ErroIfood(BLOQUEIO_ACOMPANHAMENTO_IFOOD);
}
export async function exigirComandoLoja(tx: Prisma.TransactionClient, lojaId: string) {
  await tx.$queryRaw`SELECT id FROM "LojaIfood" WHERE id=${lojaId} FOR UPDATE`;
  const l = await tx.lojaIfood.findUniqueOrThrow({ where: { id: lojaId }, select: { modoOperacao: true } });
  if (l.modoOperacao === "ACOMPANHAMENTO") throw new ErroIfood(BLOQUEIO_ACOMPANHAMENTO_IFOOD);
}
/** Fronteira adicional do transporte: GET e ACK não são comandos comerciais. */
export async function conferirTransporteAcompanhamento(integracaoId: string, caminho: string, op: { metodo?: string; corpo?: unknown; lojaId?: string; merchant?: string }) {
  const rota = caminho.split("?")[0], metodo = op.metodo ?? "GET";
  if (rota === "/events/v1.0/events/acknowledgment" && metodo === "POST") {
    if (!Array.isArray(op.corpo) || !op.corpo.length) throw new ErroIfood("ACK exige eventos persistidos desta integração.");
    const ids = op.corpo.map(v => uuid(v?.id));
    if (ids.length > 10000 || new Set(ids).size !== ids.length || await prisma.eventoIfood.count({ where: { externoId: { in: ids }, loja: { integracaoId }, ...(op.lojaId ? { lojaId: op.lojaId } : {}) } }) !== ids.length) throw new ErroIfood("ACK exige eventos persistidos desta integração.");
    return;
  }
  const merchant = /^\/merchant\/v1\.0\/merchants\/([^/]+)(?:\/|$)/.exec(rota)?.[1];
  const order = /^\/order\/v1\.0\/orders\/([^/]+)(?:\/|$)/.exec(rota)?.[1];
  const disputa = /^\/order\/v1\.0\/disputes\/([^/]+)(?:\/|$)/.exec(rota)?.[1];
  const lojas = await prisma.lojaIfood.findMany({ where: { integracaoId, ...(merchant ? { merchantId: merchant } : order ? { OR: [{ pedidos: { some: { externoId: order } } }, ...(op.lojaId ? [{ id: op.lojaId }] : [])] } : disputa ? { pedidos: { some: { disputaId: disputa } } } : op.lojaId ? { id: op.lojaId } : op.merchant ? { merchantId: op.merchant } : {}) }, include: { integracao: true } });
  if (rota === "/events/v1.0/events:polling" && (!op.lojaId || !op.merchant || lojas.length !== 1 || lojas[0].id !== op.lojaId || lojas[0].merchantId !== op.merchant)) throw new ErroIfood("Polling exige filtro único correspondente à loja solicitante.");
  if (op.lojaId && !lojas.some(l => l.id === op.lojaId)) throw new ErroIfood("Loja fora da integração solicitante.");
  if (op.lojaId && lojas.some(l => l.id !== op.lojaId)) throw new ErroIfood("Identidade do pedido/loja divergente.");
  if (order && op.lojaId && !await prisma.pedidoIfood.count({ where: { externoId: order, lojaId: op.lojaId } }) && !await prisma.eventoIfood.count({ where: { pedidoExternoId: order, lojaId: op.lojaId } })) throw new ErroIfood("Leitura exige pedido ou evento persistido desta loja.");
  if (metodo !== "GET") {
    // Um comando sem identidade comprovada não pode escapar da política por caminho arbitrário.
    const restritas = lojas.some(l => l.modoOperacao === "ACOMPANHAMENTO") || ((order || disputa) && await prisma.pedidoIfood.count({ where: { ...(order ? { externoId: order } : { disputaId: disputa }), loja: { integracaoId }, acompanhamento: true } }) > 0);
    if (restritas || !lojas.length && await prisma.lojaIfood.count({ where: { integracaoId, modoOperacao: "ACOMPANHAMENTO" } }) > 0) throw new ErroIfood(BLOQUEIO_ACOMPANHAMENTO_IFOOD);
  } else if (order || rota === "/events/v1.0/events:polling") {
    if (lojas.some(l => l.modoOperacao === "ACOMPANHAMENTO" && (!l.ativa || !l.autorizada || !recepcaoPermitida(l)))) throw new ErroIfood("Recepção do acompanhamento pausada, expirada ou não autorizada.");
  }
}
