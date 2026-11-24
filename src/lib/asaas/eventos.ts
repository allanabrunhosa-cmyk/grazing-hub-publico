import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cifrar, decifrar } from "@/lib/crypto";
import { ambienteAsaas, asaasAtivo, tokenWebhookAsaas } from "./configuracao";
import { registrarSituacao } from "./cobrancas";
import { aplicaSituacao, ErroAsaas, lerEvento, lerPagamento, lerReferenciaHub } from "./dominio";

const CONTEXTO = "grazing-hub-asaas-v1";
const LIMITE_CORPO = 200_000;
const iguais = (a: string, b: string) => {
  const x = createHash("sha256").update(a).digest(), y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
};

/**
 * Entrada do webhook: autentica pelo token, persiste e só então confirma.
 * Nada é processado aqui; o processador trabalha a fila fora da requisição.
 */
export async function receberEventoAsaas(corpo: string, token: string | null): Promise<{ status: number }> {
  const esperado = tokenWebhookAsaas();
  if (!esperado) return { status: 503 };
  if (!token || !iguais(token, esperado)) return { status: 401 };
  if (corpo.length > LIMITE_CORPO) return { status: 413 };
  let evento;
  try { evento = lerEvento(JSON.parse(corpo)); } catch { return { status: 400 }; }
  await prisma.eventoAsaas.createMany({ skipDuplicates: true, data: [{ id: randomUUID(), ambiente: ambienteAsaas(), externoId: evento.id, tipo: evento.tipo, pagamentoId: evento.pagamentoId, ocorridoEm: evento.ocorridoEm, payloadCifrado: cifrar(corpo, CONTEXTO) }] });
  return { status: 200 };
}

const ESPERA_VINCULO_MS = 2 * 3600_000;

/** Processa um evento pendente. Devolve false quando a fila está vazia. */
export async function processarEventoAsaas() {
  if (!asaasAtivo()) return false;
  let eventoId: string | undefined;
  try {
    return await prisma.$transaction(async tx => {
      const candidatos = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "EventoAsaas" WHERE estado='PENDENTE' AND "proximaTentativa"<=(now() AT TIME ZONE 'UTC') AND ambiente=${ambienteAsaas()} ORDER BY "ocorridoEm" NULLS FIRST, "recebidoEm", id LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!candidatos.length) return false;
      eventoId = candidatos[0].id;
      const e = await tx.eventoAsaas.findUniqueOrThrow({ where: { id: eventoId } });
      const concluir = (estado: string, erro: string | null = null) => tx.eventoAsaas.update({ where: { id: e.id }, data: { estado, erro } });
      if (!e.tipo.startsWith("PAYMENT_") || !e.pagamentoId) { await concluir("IGNORADO", "Evento sem efeito sobre cobranças do HUB"); return true; }
      const evento = lerEvento(JSON.parse(decifrar(e.payloadCifrado, CONTEXTO)));
      const pg = lerPagamento({ ...evento.pagamento, ...(e.tipo === "PAYMENT_DELETED" ? { deleted: true } : {}) });
      // Uma trava por cobrança externa serializa eventos concorrentes do mesmo pagamento.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"asaas-pagamento:" + e.ambiente + ":" + pg.id}))`;
      let cobranca = await tx.cobrancaAsaas.findUnique({ where: { ambiente_asaasId: { ambiente: e.ambiente, asaasId: pg.id } } });
      if (!cobranca) {
        // Envio do HUB cuja resposta se perdeu: a referência única identifica a linha local.
        const ref = lerReferenciaHub(pg.referencia);
        const local = ref ? await tx.cobrancaAsaas.findUnique({ where: { id: ref.cobrancaId } }) : null;
        if (local && local.ambiente === e.ambiente && !local.asaasId && local.origem === "HUB" && local.valor.eq(pg.valor)) {
          cobranca = await tx.cobrancaAsaas.update({ where: { id: local.id }, data: { estado: "ATIVA", asaasId: pg.id, clienteAsaasId: pg.cliente, linkPagamento: pg.link, linkBoleto: pg.boleto, erro: null } });
        }
      }
      if (!cobranca) {
        // Cobrança criada pelo checkout do site: vincula ao pedido já recebido do WooCommerce.
        const numero = pg.referencia && /^\d{1,12}$/.test(pg.referencia) ? pg.referencia : null;
        const site = await tx.pedidoSite.findFirst({ where: { OR: [{ asaasPagamentoId: pg.id }, ...(numero ? [{ externoId: numero }, { numeroExterno: numero }] : [])] }, include: { integracao: { select: { criadoPorId: true } }, pedido: { select: { total: true } } }, orderBy: { createdAt: "desc" } });
        if (site && site.pedido.total.eq(pg.valor)) {
          cobranca = await tx.cobrancaAsaas.create({ data: { ambiente: e.ambiente, pedidoId: site.pedidoId, origem: "SITE", forma: pg.forma, valor: pg.valor, vencimento: pg.vencimento ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"), estado: "ATIVA", asaasId: pg.id, clienteAsaasId: pg.cliente, linkPagamento: pg.link, linkBoleto: pg.boleto, chaveOperacao: `asaas-site:${e.ambiente}:${pg.id}`, hashOperacao: createHash("sha256").update(pg.id).digest("hex"), criadoPorId: site.integracao.criadoPorId } });
          if (!site.asaasPagamentoId) await tx.pedidoSite.update({ where: { id: site.id }, data: { asaasPagamentoId: pg.id } });
        }
      }
      if (!cobranca) {
        // O pedido do site pode chegar depois do pagamento: aguardar antes de desistir.
        if (Date.now() - e.recebidoEm.getTime() > ESPERA_VINCULO_MS) await concluir("SEM_VINCULO", "Cobrança sem pedido correspondente no HUB");
        else await tx.eventoAsaas.update({ where: { id: e.id }, data: { tentativas: { increment: 1 }, proximaTentativa: new Date(Date.now() + Math.min(900_000, 30_000 * 2 ** Math.min(e.tentativas, 5))), erro: "Aguardando o pedido correspondente" } });
        return true;
      }
      if (!pg.situacao) { await concluir("IGNORADO", "Status do Asaas desconhecido; cobrança preservada"); return true; }
      if (aplicaSituacao(cobranca, pg.situacao, e.ocorridoEm)) {
        const autor = await tx.usuario.findUnique({ where: { id: cobranca.criadoPorId }, select: { id: true } });
        if (!autor) throw new ErroAsaas("Responsável pela cobrança indisponível no cadastro.");
        await registrarSituacao(tx, cobranca.id, { situacao: pg.situacao, statusRemoto: pg.status, ocorridoEm: e.ocorridoEm ?? new Date(), chave: `asaas-evento:${e.id}`, autor: { userId: autor.id, nome: "Integração Asaas" }, liquido: pg.liquido, pagoEm: pg.situacao === "PAGA" ? pg.pagoEm ?? e.ocorridoEm ?? new Date() : null, creditoPrevisto: pg.creditoPrevisto, link: pg.link, boleto: pg.boleto });
      }
      await concluir("PROCESSADO");
      return true;
    }, { timeout: 30000, maxWait: 10000 });
  } catch (erro) {
    if (!eventoId) throw erro;
    const e = await prisma.eventoAsaas.findUniqueOrThrow({ where: { id: eventoId } });
    const permanente = erro instanceof ErroAsaas || erro instanceof SyntaxError;
    await prisma.eventoAsaas.updateMany({ where: { id: e.id, estado: "PENDENTE", tentativas: e.tentativas }, data: { tentativas: { increment: 1 }, estado: permanente || e.tentativas >= 8 ? "FALHOU" : "PENDENTE", proximaTentativa: new Date(Date.now() + Math.min(900_000, 30_000 * 2 ** Math.min(e.tentativas, 5))), erro: erro instanceof ErroAsaas ? erro.message.slice(0, 300) : "Falha local ao processar; evento preservado" } });
    return true;
  }
}

/** Quando um pedido do site chega, eventos que o aguardavam voltam para a fila. */
export async function retomarEventosDoPagamento(tx: { eventoAsaas: typeof prisma.eventoAsaas }, pagamentoId: string) {
  await tx.eventoAsaas.updateMany({ where: { pagamentoId, estado: { in: ["SEM_VINCULO", "PENDENTE"] } }, data: { estado: "PENDENTE", proximaTentativa: new Date() } });
}
