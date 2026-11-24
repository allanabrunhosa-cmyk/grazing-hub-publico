import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { cifrar } from "@/lib/crypto";
import { resolverClienteCanonico } from "@/lib/vendas/clientes-unicidade";
import { formatarCpfCnpj } from "@/lib/documento-brasileiro";
import { retomarEventosDoPagamento } from "@/lib/asaas/eventos";
import { adaptarPedidoSite, ErroSite, idExterno, instanteGmt, objeto, resumoComercial, STATUS_IGNORADOS, texto, type PedidoSiteAdaptado } from "./adaptador";
import { chamarSite, FalhaHttpSite, metasEntregaSite, segredoWebhookSite, siteAtivo } from "./cliente";

type Tx = Prisma.TransactionClient;
const CONTEXTO = "grazing-hub-site-v1";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const AUTOR = "Integração Site";
/** jsonb não preserva a ordem das chaves: comparar fotografias exige serialização ordenada. */
const ordenar = (v: unknown): unknown => Array.isArray(v) ? v.map(ordenar) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, ordenar(x)])) : v;
const hashEstavel = (v: unknown) => hash(ordenar(v));

/** Assinatura do WooCommerce: base64 do HMAC-SHA256 dos bytes originais do corpo. */
export function assinaturaValida(corpo: Buffer, assinatura: string | null, segredo: string) {
  if (!assinatura) return false;
  const esperado = createHmac("sha256", segredo).update(corpo).digest(), recebido = Buffer.from(assinatura, "base64");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/**
 * Entrada do webhook. O aviso só aponta qual pedido mudou: o conteúdo é sempre
 * relido pela API autenticada, portanto nenhum dado do corpo é gravado.
 */
export async function receberAvisoSite(corpo: Buffer, cab: { assinatura: string | null; topico: string | null; entrega: string | null }): Promise<{ status: number }> {
  const segredo = segredoWebhookSite();
  if (!segredo) return { status: 503 };
  if (corpo.length > 2_000_000) return { status: 413 };
  if (!assinaturaValida(corpo, cab.assinatura, segredo)) return { status: 401 };
  if (!cab.topico || !/^order\.(created|updated|deleted|restored)$/.test(cab.topico)) return { status: 200 };
  let externoId: string;
  // O ping de criação do webhook não traz pedido: confirmar sem gravar.
  try { externoId = idExterno(objeto(JSON.parse(corpo.toString("utf8"))).id); } catch { return { status: 200 }; }
  const integracao = await prisma.integracaoSite.findUnique({ where: { contaId: "singleton" }, select: { id: true, ativa: true } });
  // Pausada: a coleta periódica recupera o intervalo ao reativar; recusar desativaria o webhook no site.
  if (!integracao?.ativa) return { status: 200 };
  const chave = `aviso:${cab.entrega && /^[A-Za-z0-9_-]{1,100}$/.test(cab.entrega) ? cab.entrega : createHash("sha256").update(corpo).digest("hex")}`;
  await prisma.eventoSite.createMany({ skipDuplicates: true, data: [{ id: randomUUID(), integracaoId: integracao.id, chave, pedidoExternoId: externoId, topico: cab.topico }] });
  await prisma.integracaoSite.update({ where: { id: integracao.id }, data: { ultimoRecebimento: new Date() } });
  return { status: 200 };
}

const PAGINAS = 20, SOBREPOSICAO_MS = 300_000;
/** Coleta periódica: recupera avisos perdidos e o intervalo em que a integração esteve pausada. */
export async function coletarPedidosSite() {
  if (!siteAtivo()) return false;
  const token = randomUUID();
  const i = await prisma.$transaction(async tx => {
    const ids = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "IntegracaoSite" WHERE ativa AND "contaId"='singleton' AND "proximaColeta"<=(now() AT TIME ZONE 'UTC') AND ("leaseAte" IS NULL OR "leaseAte"<(now() AT TIME ZONE 'UTC')) LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!ids.length) return null;
    return tx.integracaoSite.update({ where: { id: ids[0].id }, data: { leaseToken: token, leaseAte: new Date(Date.now() + 180000), proximaColeta: new Date(Date.now() + 60000) } });
  });
  if (!i) return false;
  try {
    const inicio = new Date(), desde = new Date((i.cursor ?? i.createdAt).getTime() - SOBREPOSICAO_MS);
    const vistos: { externoId: string; modificado: string }[] = [];
    let paginas = 1;
    for (let pagina = 1; pagina <= paginas; pagina++) {
      if (pagina > PAGINAS) throw new ErroSite("Volume de pedidos alterados acima do limite da coleta; conferir a integração.");
      const r = await chamarSite("/orders", { modified_after: desde.toISOString().slice(0, 19), dates_are_gmt: "true", per_page: "100", page: String(pagina) });
      if (!Array.isArray(r.dados)) throw new ErroSite("Listagem de pedidos do site fora do contrato.");
      paginas = r.paginas;
      for (const v of r.dados) {
        const o = objeto(v);
        if (STATUS_IGNORADOS.includes(texto(o.status, 60))) continue;
        vistos.push({ externoId: idExterno(o.id), modificado: texto(o.date_modified_gmt, 30) });
      }
    }
    const conhecidos = await prisma.pedidoSite.findMany({ where: { integracaoId: i.id, externoId: { in: vistos.map(v => v.externoId) } }, select: { externoId: true, modificadoEm: true } });
    const novos = vistos.filter(v => { const c = conhecidos.find(c => c.externoId === v.externoId), m = instanteGmt(v.modificado); return !c || !c.modificadoEm || !m || m > c.modificadoEm; });
    if (novos.length) await prisma.eventoSite.createMany({ skipDuplicates: true, data: novos.map(v => ({ id: randomUUID(), integracaoId: i.id, chave: `coleta:${v.externoId}:${v.modificado}`, pedidoExternoId: v.externoId, topico: "coleta" })) });
    await prisma.integracaoSite.updateMany({ where: { id: i.id, leaseToken: token }, data: { cursor: inicio, ultimaColeta: new Date(), ultimoErro: null, leaseToken: null, leaseAte: null } });
  } catch (e) {
    await prisma.integracaoSite.updateMany({ where: { id: i.id, leaseToken: token }, data: { leaseToken: null, leaseAte: null, proximaColeta: new Date(Date.now() + (e instanceof FalhaHttpSite && e.status === 429 ? 300000 : 120000)), ultimoErro: e instanceof ErroSite ? e.message : "Falha local na coleta; nova tentativa agendada" } });
  }
  return true;
}

async function localizarCliente(tx: Tx, c: PedidoSiteAdaptado["cliente"]) {
  if (c.documento) {
    const porDocumento = await tx.clienteVenda.findFirst({ where: { documento: { in: [c.documento, formatarCpfCnpj(c.documento)] } }, select: { id: true } });
    if (porDocumento) return resolverClienteCanonico(tx, porDocumento.id);
  }
  if (c.email) {
    const porEmail = await tx.clienteVenda.findMany({ where: { email: { equals: c.email, mode: "insensitive" }, ativo: true, unificadoEmId: null }, select: { id: true }, take: 2 });
    if (porEmail.length === 1) return resolverClienteCanonico(tx, porEmail[0].id);
  }
  return null;
}
/** Vínculo explícito (identidade externa) primeiro; depois SKU igual ao código do produto no HUB. */
async function localizarProdutos(tx: Tx, loja: string, itens: PedidoSiteAdaptado["itens"]) {
  const vinculos = await tx.identidadeExternaVenda.findMany({ where: { origem: "SITE", loja, entidade: "PRODUTO", chave: { in: itens.flatMap(i => i.chaves) } }, select: { chave: true, destinoId: true } });
  const skus = itens.map(i => i.sku).filter(Boolean);
  const produtos = await tx.produtoVenda.findMany({ where: { OR: [{ id: { in: vinculos.map(v => v.destinoId) } }, ...(skus.length ? [{ codigo: { in: skus } }] : [])] }, select: { id: true, codigo: true } });
  return (i: PedidoSiteAdaptado["itens"][number]) => {
    const destino = i.chaves.map(c => vinculos.find(v => v.chave === c)?.destinoId).find(Boolean);
    return produtos.find(p => p.id === destino)?.id ?? (i.sku ? produtos.find(p => p.codigo === i.sku)?.id : undefined) ?? null;
  };
}
const itensParaBanco = (p: PedidoSiteAdaptado, produto: (i: PedidoSiteAdaptado["itens"][number]) => string | null, versaoPedido: number) =>
  p.itens.map(i => { const { chaves, sku, ...linha } = i; void chaves; void sku; return { ...linha, escolhasSnapshot: json(linha.escolhasSnapshot), versaoPedido, produtoId: produto(i) }; });

/** Processa um aviso pendente. Devolve false quando a fila está vazia. */
export async function processarEventoSite() {
  if (!siteAtivo()) return false;
  let eventoId: string | undefined;
  try {
    return await prisma.$transaction(async tx => {
      const candidatos = await tx.$queryRaw<{ id: string }[]>`SELECT e.id FROM "EventoSite" e JOIN "IntegracaoSite" i ON i.id=e."integracaoId" WHERE e.estado='PENDENTE' AND e."proximaTentativa"<=(now() AT TIME ZONE 'UTC') AND i.ativa AND i."contaId"='singleton' ORDER BY e."recebidoEm", e.id LIMIT 1 FOR UPDATE OF e SKIP LOCKED`;
      if (!candidatos.length) return false;
      eventoId = candidatos[0].id;
      const e = await tx.eventoSite.findUniqueOrThrow({ where: { id: eventoId }, include: { integracao: true } });
      const concluir = async (estado: string, erro: string | null = null) => { await tx.eventoSite.update({ where: { id: e.id }, data: { estado, erro } }); return true; };
      // Uma trava por pedido serializa avisos concorrentes e a criação da identidade interna.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"site-pedido:" + e.integracaoId + ":" + e.pedidoExternoId}))`;
      const externo = await tx.pedidoSite.findUnique({ where: { integracaoId_externoId: { integracaoId: e.integracaoId, externoId: e.pedidoExternoId } } });
      let recebido: unknown;
      try { recebido = (await chamarSite(`/orders/${idExterno(e.pedidoExternoId)}`)).dados; }
      catch (erro) {
        if (!(erro instanceof FalhaHttpSite) || erro.status !== 404) throw erro;
        if (externo) await tx.pedidoSite.update({ where: { id: externo.id }, data: { pendencia: "Pedido não encontrado no site (excluído). Confira antes de produzir ou entregar." } });
        return concluir(externo ? "PROCESSADO" : "IGNORADO", "Pedido inexistente no site");
      }
      if (STATUS_IGNORADOS.includes(texto(objeto(recebido).status, 60)) && !externo) return concluir("IGNORADO", "Rascunho de checkout");
      const config = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
      const fuso = config?.fusoHorario ?? "America/Sao_Paulo";
      const p = adaptarPedidoSite(recebido, { fuso, ...metasEntregaSite() });
      if (p.externoId !== e.pedidoExternoId) throw new ErroSite("Identidade do pedido divergente.");
      const resumo = hash(resumoComercial(p)), produto = await localizarProdutos(tx, e.integracao.loja, p.itens);
      const semProduto = p.itens.filter(i => !produto(i)).length;
      const pendencias = [...p.pendencias, ...(semProduto ? [`${semProduto} ${semProduto === 1 ? "item sem produto vinculado" : "itens sem produto vinculado"} no HUB`] : [])];
      const agora = new Date();

      if (!externo) {
        if (p.statusInterno === "CANCELADO") return concluir("IGNORADO", "Pedido cancelado no site antes de chegar ao HUB");
        const canal = await tx.canalVenda.findUnique({ where: { id: e.integracao.canalId }, select: { id: true, nome: true } });
        if (!canal) throw new ErroSite("Canal de venda da integração indisponível.");
        const clienteId = await localizarCliente(tx, p.cliente);
        const confirmado = p.statusInterno === "CONFIRMADO";
        const pedido = await tx.pedidoVenda.create({ data: {
          ...p.dados, compradorSnapshot: json(p.dados.compradorSnapshot), destinatarioSnapshot: json(p.dados.destinatarioSnapshot), pagamentoInformadoSnapshot: json(p.dados.pagamentoInformadoSnapshot),
          enderecoSnapshot: p.dados.enderecoSnapshot ? json(p.dados.enderecoSnapshot) : Prisma.DbNull,
          modoFinanceiro: "EXTERNO", versaoFinanceiro: 1, status: p.statusInterno, fusoHorario: fuso, clienteId, canalId: canal.id, canalNomeSnapshot: canal.nome,
          chaveCriacao: `site:${e.integracao.loja}:${p.externoId}`, hashCriacao: resumo, referenciaOrigem: "SITE", referenciaEstabelecimento: e.integracao.loja, referenciaPedido: p.externoId,
          criadoPorId: e.integracao.criadoPorId, confirmadoEm: confirmado ? p.pagoEm ?? p.modificadoEm ?? agora : null,
          itens: { create: itensParaBanco(p, produto, 1) },
        } });
        await tx.pedidoSite.create({ data: { integracaoId: e.integracaoId, externoId: p.externoId, numeroExterno: p.numero, pedidoId: pedido.id, statusRemoto: p.status, modificadoEm: p.modificadoEm, snapshotCifrado: cifrar(JSON.stringify(p.snapshot), CONTEXTO), hashSnapshot: resumo, pendencia: pendencias.join("; ") || null, asaasPagamentoId: p.asaasPagamentoId } });
        await tx.historicoPedidoVenda.create({ data: { pedidoId: pedido.id, tipo: "SITE_PEDIDO_RECEBIDO", chaveOperacao: `site-evento:${e.id}`, hashOperacao: resumo, usuarioId: e.integracao.criadoPorId, usuarioNome: AUTOR, versaoAnterior: null, versaoNova: 1, depois: { numeroSite: p.numero, statusSite: p.status, status: p.statusInterno, total: p.dados.total, clienteVinculado: !!clienteId } } });
        if (p.asaasPagamentoId) await retomarEventosDoPagamento(tx, p.asaasPagamentoId);
        await tx.integracaoSite.update({ where: { id: e.integracaoId }, data: { ultimoRecebimento: agora } });
        return concluir("PROCESSADO");
      }

      await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${externo.pedidoId} FOR UPDATE`;
      const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: externo.pedidoId }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } });
      const mudouConteudo = externo.hashSnapshot !== resumo, mudouStatus = externo.statusRemoto !== p.status;
      const dados: Prisma.PedidoVendaUpdateInput = {};
      const avisos = [...pendencias];
      const emProducao = pedido.statusOperacional !== "PENDENTE";
      if (pedido.status === "CANCELADO") {
        if (p.statusInterno !== "CANCELADO") avisos.push("Pedido cancelado no HUB continua ativo no site");
      } else {
        if (mudouConteudo) {
          const itensIguais = hashEstavel(p.itens.map(i => [i.produtoSnapshot, new Prisma.Decimal(i.quantidade).toString(), i.escolhasSnapshot, i.totalLinha])) === hashEstavel(pedido.itens.map(i => [i.produtoSnapshot, i.quantidade.toString(), i.escolhasSnapshot, i.totalLinha.toFixed(2)]));
          if (!itensIguais && emProducao) avisos.push("Itens alterados no site após o início da produção; o HUB manteve os itens anteriores");
          else {
            Object.assign(dados, { ...p.dados, compradorSnapshot: json(p.dados.compradorSnapshot), destinatarioSnapshot: json(p.dados.destinatarioSnapshot), pagamentoInformadoSnapshot: json(p.dados.pagamentoInformadoSnapshot), enderecoSnapshot: p.dados.enderecoSnapshot ? json(p.dados.enderecoSnapshot) : Prisma.DbNull });
            // Reagendamento feito no HUB prevalece quando o site não informa a data.
            if (!p.dados.previsaoData) { delete dados.previsaoData; delete dados.previsaoJanela; }
            if (!itensIguais) {
              await tx.itemPedidoVenda.updateMany({ where: { pedidoId: pedido.id, vigente: true }, data: { vigente: false } });
              dados.itens = { create: itensParaBanco(p, produto, pedido.versao + 1) };
            }
          }
        }
        if (p.statusInterno === "CANCELADO") {
          if (pedido.statusOperacional === "ENTREGUE") avisos.push("Cancelado ou reembolsado no site após a entrega; confira o tratamento");
          else if (emProducao) avisos.push("Cancelado no site com produção iniciada; conclua o cancelamento no HUB");
          else Object.assign(dados, { status: "CANCELADO", statusOperacional: "INTERROMPIDO", canceladoEm: agora });
        } else if (p.statusInterno === "CONFIRMADO" && pedido.status === "RECEBIDO_EXTERNO") Object.assign(dados, { status: "CONFIRMADO", confirmadoEm: p.pagoEm ?? agora });
        else if (p.statusInterno === "RECEBIDO_EXTERNO" && pedido.status === "CONFIRMADO") avisos.push("O site voltou o pedido para aguardando pagamento; confira antes de produzir");
      }
      const alterou = Object.keys(dados).length > 0;
      if (alterou) await tx.pedidoVenda.update({ where: { id: pedido.id }, data: { ...dados, versao: { increment: 1 } } });
      await tx.pedidoSite.update({ where: { id: externo.id }, data: { statusRemoto: p.status, modificadoEm: p.modificadoEm, snapshotCifrado: cifrar(JSON.stringify(p.snapshot), CONTEXTO), hashSnapshot: resumo, pendencia: avisos.join("; ") || null, asaasPagamentoId: p.asaasPagamentoId ?? externo.asaasPagamentoId } });
      if (alterou || mudouStatus) await tx.historicoPedidoVenda.create({ data: { pedidoId: pedido.id, tipo: "SITE_PEDIDO_ATUALIZADO", chaveOperacao: `site-evento:${e.id}`, hashOperacao: resumo, usuarioId: e.integracao.criadoPorId, usuarioNome: AUTOR, versaoAnterior: pedido.versao, versaoNova: pedido.versao + (alterou ? 1 : 0), depois: { statusSite: p.status, statusAnteriorSite: externo.statusRemoto, status: (dados.status as string | undefined) ?? pedido.status, total: p.dados.total, aplicado: alterou } } });
      if (p.asaasPagamentoId && p.asaasPagamentoId !== externo.asaasPagamentoId) await retomarEventosDoPagamento(tx, p.asaasPagamentoId);
      return concluir("PROCESSADO");
    }, { timeout: 45000, maxWait: 10000 });
  } catch (erro) {
    if (!eventoId) throw erro;
    const e = await prisma.eventoSite.findUniqueOrThrow({ where: { id: eventoId } });
    const permanente = erro instanceof ErroSite && (!(erro instanceof FalhaHttpSite) || erro.status >= 400 && erro.status < 500 && erro.status !== 429);
    await prisma.eventoSite.updateMany({ where: { id: e.id, estado: "PENDENTE", tentativas: e.tentativas }, data: { tentativas: { increment: 1 }, estado: permanente || e.tentativas >= 6 ? "FALHOU" : "PENDENTE", proximaTentativa: new Date(Date.now() + Math.min(900_000, 30_000 * 2 ** Math.min(e.tentativas, 5))), erro: erro instanceof ErroSite ? erro.message.slice(0, 300) : "Falha local ao processar; aviso preservado" } });
    if (erro instanceof FalhaHttpSite && [401, 403].includes(erro.status)) await prisma.integracaoSite.updateMany({ where: { id: e.integracaoId }, data: { ultimoErro: erro.message } });
    return true;
  }
}
