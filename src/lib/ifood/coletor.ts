import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ErroIfood, lerEvento } from "./dominio";
import { FalhaHttpIfood } from "./cliente";
import { requisicaoAutorizada } from "./tokens";
import { persistirEventos } from "./processamento";
import { filtroRecepcaoSql, recepcaoPermitida } from "./acompanhamento";

export async function coletarEventos() {
  if (process.env.IFOOD_ATIVO !== "1") return false;
  // Expiração só pausa nosso coletor; não escreve disponibilidade no iFood/Takeat.
  await prisma.lojaIfood.updateMany({ where: { integracao: { contaId: "singleton" }, modoOperacao: "ACOMPANHAMENTO", ativa: true, pilotoAte: { lte: new Date() } }, data: { ativa: false, ultimoErro: "Janela do acompanhamento encerrada; recepção pausada e histórico preservado." } });
  const token = randomUUID();
  const loja = await prisma.$transaction(async tx => {
    const ids = await tx.$queryRaw<{ id: string }[]>`SELECT l.id FROM "LojaIfood" l JOIN "IntegracaoIfood" i ON i.id=l."integracaoId" WHERE l.ativa AND l.autorizada AND i.ativo AND i."contaId"='singleton' AND ${filtroRecepcaoSql()} AND l."proximoPolling"<=(now() AT TIME ZONE 'UTC') AND (l."leaseAte" IS NULL OR l."leaseAte"<(now() AT TIME ZONE 'UTC')) ORDER BY l."proximoPolling" LIMIT 1 FOR UPDATE OF l SKIP LOCKED`;
    if (!ids.length) return null;
    const l = await tx.lojaIfood.findUniqueOrThrow({ where: { id: ids[0].id }, include: { integracao: true } });
    if (!recepcaoPermitida(l)) return null;
    return tx.lojaIfood.update({ where: { id: l.id }, data: { leaseToken: token, leaseAte: new Date(Date.now() + 120000), proximoPolling: new Date(Date.now() + 30000) } });
  });
  if (!loja) return false;
  try {
    // Refresh de autorização a cada dez minutos; uma revogação bloqueia polling e ações.
    if (!loja.ultimaAutorizacao || Date.now() - loja.ultimaAutorizacao.getTime() >= 600000) {
      await requisicaoAutorizada(loja.integracaoId, `/merchant/v1.0/merchants/${loja.merchantId}`);
      await prisma.lojaIfood.update({ where: { id: loja.id }, data: { ultimaAutorizacao: new Date() } });
    }
    const r = await requisicaoAutorizada(loja.integracaoId, "/events/v1.0/events:polling", { merchant: loja.merchantId, lojaId: loja.id });
    const atual = await prisma.lojaIfood.findUniqueOrThrow({ where: { id: loja.id } });
    if (atual.leaseToken !== token || !atual.leaseAte || atual.leaseAte <= new Date() || !atual.ativa || !atual.autorizada) return false;
    const dados = r.status === 204 ? [] : r.dados;
    if (!Array.isArray(dados)) throw new ErroIfood("Polling fora do contrato.");
    const eventos = dados.map(v => lerEvento(v, loja.merchantId));
    await persistirEventos(loja.id, eventos);
    // Só seleciona IDs confirmados no banco; inclui ACK pendente de tentativa anterior.
    // Guia/homologação limitam o lote a 2.000; a referência HTTP admite até 10.000.
    const pendentes = await prisma.eventoIfood.findMany({ where: { lojaId: loja.id, ackEm: null }, select: { id: true, externoId: true }, take: 2000, orderBy: { recebidoEm: "asc" } });
    if (pendentes.length) {
      const ack = await requisicaoAutorizada(loja.integracaoId, "/events/v1.0/events/acknowledgment", { metodo: "POST", lojaId: loja.id, corpo: pendentes.map(e => ({ id: e.externoId })) });
      if (ack.status !== 202) throw new ErroIfood("ACK fora do contrato; eventos preservados.");
      await prisma.eventoIfood.updateMany({ where: { id: { in: pendentes.map(e => e.id) } }, data: { ackEm: new Date() } });
    }
    await prisma.lojaIfood.updateMany({ where: { id: loja.id, leaseToken: token }, data: { ultimoPolling: new Date(), ultimoErro: null, leaseToken: null, leaseAte: null, proximoPolling: new Date(Date.now() + 30000) } });
  } catch (e) {
    const revogada = e instanceof FalhaHttpIfood && [401, 403].includes(e.status);
    await prisma.lojaIfood.updateMany({ where: { id: loja.id, leaseToken: token }, data: { leaseToken: null, leaseAte: null, ...(revogada ? { autorizada: false } : {}), proximoPolling: new Date(Date.now() + (e instanceof FalhaHttpIfood && e.status === 429 ? Math.max(30000, e.esperaMs) : 60000)), ultimoErro: e instanceof ErroIfood ? e.message : "Falha ao persistir/receber eventos; recepção será retomada" } });
  }
  return true;
}
