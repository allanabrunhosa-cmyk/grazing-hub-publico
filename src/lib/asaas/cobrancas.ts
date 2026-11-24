import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { diaNoFuso } from "@/lib/vendas/pedidos-agenda-dominio";
import { chamarAsaas, FalhaHttpAsaas } from "./cliente";
import { ambienteAsaas, asaasAtivo, notificarClienteAsaas } from "./configuracao";
import { ErroAsaas, idCliente, lerPagamento, objeto, referenciaHub, texto, tipoCobranca, titularCobranca, validarEntradaCobranca, type AmbienteAsaas, type PagamentoAsaas } from "./dominio";

type Tx = Prisma.TransactionClient;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
function identificador(v: unknown) {
  if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(v)) throw new ErroAsaas("Identificador inválido.");
  return v;
}
const dia = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null;
type Linha = { id: string; ambiente: string; origem: string; forma: string; valor: Prisma.Decimal; vencimento: Date; estado: string; situacao: string; linkPagamento: string | null; linkBoleto: string | null; valorLiquido: Prisma.Decimal | null; pagoEm: Date | null; erro: string | null; createdAt: Date };
/** Lista fechada para a interface: sem identificadores do Asaas, payloads ou dados do titular. */
export function cobrancaParaInterface(c: Linha) {
  return { id: c.id, ambiente: c.ambiente, origem: c.origem, forma: c.forma, valor: c.valor.toFixed(2), vencimento: dia(c.vencimento)!, estado: c.estado, situacao: c.situacao,
    link: c.linkPagamento, boleto: c.linkBoleto, liquido: c.valorLiquido?.toFixed(2) ?? null, pagoEm: dia(c.pagoEm), erro: c.erro, criadaEm: c.createdAt.toISOString() };
}
export type CobrancaAsaasInterface = ReturnType<typeof cobrancaParaInterface>;

export async function listarCobrancasPedido(pedidoId: string) {
  return (await prisma.cobrancaAsaas.findMany({ where: { pedidoId }, orderBy: { createdAt: "desc" }, take: 20 })).map(cobrancaParaInterface);
}
/** Leitura única do detalhe do pedido: cobranças no Asaas e vínculo com o pedido do site. */
export async function consultarCobrancaExternaPedido(pedidoId: string) {
  const [cobrancas, site] = await Promise.all([listarCobrancasPedido(pedidoId), prisma.pedidoSite.findUnique({ where: { pedidoId }, select: { numeroExterno: true, statusRemoto: true, pendencia: true } })]);
  return { ativo: asaasAtivo(), cobrancas, site: site ? { numero: site.numeroExterno, status: site.statusRemoto, pendencia: site.pendencia } : null };
}

/** O Asaas permite clientes duplicados: sempre consultar antes de criar. */
async function localizarOuCriarCliente(ambiente: AmbienteAsaas, titular: ReturnType<typeof titularCobranca>, clienteHubId: string | null) {
  const lista = objeto(await chamarAsaas(ambiente, "/customers", { consulta: { cpfCnpj: titular.cpfCnpj, limit: "10" } })).data;
  const existente = Array.isArray(lista) ? lista.map(v => objeto(v)).find(c => c.deleted !== true && typeof c.id === "string") : null;
  if (existente) return idCliente(existente.id);
  return idCliente(objeto(await chamarAsaas(ambiente, "/customers", { metodo: "POST", corpo: { ...titular, notificationDisabled: !notificarClienteAsaas(), ...(clienteHubId ? { externalReference: clienteHubId } : {}) } })).id);
}

async function ativar(tx: Tx, cobrancaId: string, pg: PagamentoAsaas, autor: { userId: string; nome: string }, clienteAsaasId?: string) {
  const c = await tx.cobrancaAsaas.findUniqueOrThrow({ where: { id: cobrancaId } });
  if (c.estado === "ATIVA") return c;
  if (!pg.valor.eq(c.valor)) throw new ErroAsaas("O Asaas devolveu valor diferente do pedido; cobrança preservada para conferência.");
  const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: c.pedidoId }, select: { versao: true } });
  const atual = await tx.cobrancaAsaas.update({ where: { id: c.id }, data: {
    estado: "ATIVA", asaasId: pg.id, clienteAsaasId: clienteAsaasId ?? pg.cliente, statusRemoto: pg.status, situacao: pg.situacao ?? "AGUARDANDO",
    linkPagamento: pg.link, linkBoleto: pg.boleto, valorLiquido: pg.liquido, erro: null,
  } });
  await tx.historicoPedidoVenda.upsert({ where: { chaveOperacao: `asaas-cobranca-criada:${c.id}` }, update: {}, create: {
    pedidoId: c.pedidoId, tipo: "ASAAS_COBRANCA_CRIADA", chaveOperacao: `asaas-cobranca-criada:${c.id}`, hashOperacao: c.hashOperacao,
    usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: pedido.versao, versaoNova: pedido.versao,
    depois: { cobrancaId: c.id, ambiente: c.ambiente, forma: c.forma, valor: c.valor.toFixed(2), vencimento: dia(c.vencimento), baixaFinanceira: false },
  } });
  return atual;
}

/**
 * Gera a cobrança do total do pedido. A linha local nasce antes da chamada externa:
 * resposta incerta nunca vira segunda cobrança, e o índice parcial do banco impede
 * duas cobranças em aberto para o mesmo pedido.
 */
export async function gerarCobrancaAsaas(pedidoValor: unknown, entrada: unknown, operacao: unknown, sessao: SessaoAtual) {
  if (!asaasAtivo()) throw new ErroAsaas("A integração com o Asaas está desativada no servidor.");
  const ambiente = ambienteAsaas(), pedidoId = identificador(pedidoValor), chave = `asaas-cobranca:${identificador(operacao)}`;
  const preparo = await prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "confirmar"], pedidoId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"asaas-cobranca-pedido:" + pedidoId}))`;
    const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, select: { id: true, numero: true, status: true, origem: true, total: true, fusoHorario: true, clienteId: true, compradorSnapshot: true, cobrancaSnapshot: true } });
    const d = validarEntradaCobranca(entrada, diaNoFuso(new Date(), p.fusoHorario));
    const resumo = hash([pedidoId, ambiente, d.forma, d.vencimento, p.total.toFixed(2)]);
    const repetida = await tx.cobrancaAsaas.findUnique({ where: { chaveOperacao: chave } });
    if (repetida) {
      if (repetida.hashOperacao !== resumo) throw new ErroAsaas("Esta solicitação já foi usada com outros dados.");
      return { cobranca: repetida, enviar: false as const };
    }
    if (p.origem !== "INTERNO") throw new ErroAsaas("Pedidos recebidos de canais externos são cobrados no canal de origem.");
    if (p.status !== "CONFIRMADO") throw new ErroAsaas("Confirme o pedido antes de gerar a cobrança.");
    if (!p.total.gt(0)) throw new ErroAsaas("O pedido não tem valor a cobrar.");
    const anteriores = await tx.cobrancaAsaas.findMany({ where: { pedidoId, estado: { not: "FALHOU" } }, select: { estado: true, situacao: true } });
    if (anteriores.some(c => c.estado === "ATIVA" && c.situacao === "PAGA")) throw new ErroAsaas("Este pedido já tem cobrança paga no Asaas.");
    if (anteriores.some(c => c.estado !== "ATIVA" || ["AGUARDANDO", "VENCIDA"].includes(c.situacao))) throw new ErroAsaas("Este pedido já tem uma cobrança em aberto no Asaas. Cancele-a antes de gerar outra.");
    const titular = titularCobranca(p);
    const cobranca = await tx.cobrancaAsaas.create({ data: { ambiente, pedidoId, origem: "HUB", forma: d.forma, valor: p.total, vencimento: new Date(`${d.vencimento}T00:00:00.000Z`), chaveOperacao: chave, hashOperacao: resumo, criadoPorId: autor.userId } });
    return { cobranca, enviar: true as const, titular, numero: p.numero, clienteId: p.clienteId, autor, vencimento: d.vencimento, forma: d.forma };
  });
  if (!preparo.enviar) return cobrancaParaInterface(preparo.cobranca);
  const c = preparo.cobranca;
  let enviada = false;
  try {
    const clienteAsaasId = await localizarOuCriarCliente(ambiente, preparo.titular, preparo.clienteId);
    enviada = true;
    const pg = lerPagamento(await chamarAsaas(ambiente, "/payments", { metodo: "POST", corpo: {
      customer: clienteAsaasId, billingType: tipoCobranca(preparo.forma), value: Number(c.valor.toFixed(2)), dueDate: preparo.vencimento,
      description: `Pedido #${preparo.numero}`, externalReference: referenciaHub(preparo.numero, c.id),
    } }));
    return cobrancaParaInterface(await prisma.$transaction(tx => ativar(tx, c.id, pg, preparo.autor, clienteAsaasId)));
  } catch (e) {
    // Só a criação da cobrança pode ter efeito desconhecido; falha no cadastro do cliente é definitiva.
    const incerta = enviada && (!(e instanceof FalhaHttpAsaas) || e.incerta);
    const mensagem = e instanceof ErroAsaas ? e.message : "Falha local ao registrar a cobrança.";
    const atual = await prisma.cobrancaAsaas.update({ where: { id: c.id }, data: incerta
      ? { estado: "INCERTA", erro: "Resposta incerta do Asaas. O HUB confere automaticamente antes de permitir nova cobrança." }
      : { estado: "FALHOU", erro: mensagem.slice(0, 300) } });
    if (incerta) return cobrancaParaInterface(atual);
    throw e instanceof ErroAsaas ? e : new ErroAsaas(mensagem);
  }
}

/** Remove no Asaas uma cobrança ainda não paga. Não é estorno. */
export async function cancelarCobrancaAsaas(cobrancaValor: unknown, sessao: SessaoAtual) {
  if (!asaasAtivo()) throw new ErroAsaas("A integração com o Asaas está desativada no servidor.");
  const cobrancaId = identificador(cobrancaValor);
  const alvo = await prisma.$transaction(async tx => {
    const c = await tx.cobrancaAsaas.findUnique({ where: { id: cobrancaId } });
    if (!c) throw new ErroAsaas("Cobrança não encontrada.");
    const autor = await conferirAcesso(tx, sessao, ["consultar", "confirmar"], c.pedidoId);
    if (c.origem !== "HUB") throw new ErroAsaas("Cobranças do site são tratadas no site.");
    if (c.ambiente !== ambienteAsaas()) throw new ErroAsaas("Cobrança criada em outro ambiente do Asaas.");
    if (c.estado !== "ATIVA" || !c.asaasId) throw new ErroAsaas("Cobrança ainda em conferência com o Asaas.");
    if (!["AGUARDANDO", "VENCIDA"].includes(c.situacao)) throw new ErroAsaas("Somente cobranças em aberto podem ser canceladas. Pagamentos recebidos exigem estorno no Asaas.");
    return { c, autor };
  });
  const r = objeto(await chamarAsaas(alvo.c.ambiente as AmbienteAsaas, `/payments/${alvo.c.asaasId}`, { metodo: "DELETE" }));
  if (r.deleted !== true) throw new ErroAsaas("O Asaas não confirmou o cancelamento da cobrança.");
  return cobrancaParaInterface(await prisma.$transaction(tx => registrarSituacao(tx, alvo.c.id, { situacao: "REMOVIDA", statusRemoto: alvo.c.statusRemoto, ocorridoEm: new Date(), chave: `asaas-cancelamento:${alvo.c.id}`, autor: alvo.autor })));
}

/** Ponto único de mudança de situação: usado pelo cancelamento e pelos eventos do webhook. */
export async function registrarSituacao(tx: Tx, cobrancaId: string, fato: { situacao: string; statusRemoto: string | null; ocorridoEm: Date | null; chave: string; autor: { userId: string; nome: string }; liquido?: Prisma.Decimal | null; pagoEm?: Date | null; creditoPrevisto?: Date | null; link?: string | null; boleto?: string | null }) {
  await tx.$queryRaw`SELECT id FROM "CobrancaAsaas" WHERE id=${cobrancaId} FOR UPDATE`;
  const c = await tx.cobrancaAsaas.findUniqueOrThrow({ where: { id: cobrancaId } });
  const mudou = c.situacao !== fato.situacao;
  const atual = await tx.cobrancaAsaas.update({ where: { id: c.id }, data: {
    situacao: fato.situacao, statusRemoto: fato.statusRemoto ?? c.statusRemoto, ultimoEventoEm: fato.ocorridoEm ?? c.ultimoEventoEm,
    ...(fato.liquido !== undefined && fato.liquido !== null ? { valorLiquido: fato.liquido } : {}),
    ...(fato.pagoEm ? { pagoEm: fato.pagoEm } : {}), ...(fato.creditoPrevisto ? { creditoPrevisto: fato.creditoPrevisto } : {}),
    ...(fato.link ? { linkPagamento: fato.link } : {}), ...(fato.boleto ? { linkBoleto: fato.boleto } : {}),
  } });
  if (mudou) {
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: c.pedidoId }, select: { versao: true } });
    await tx.historicoPedidoVenda.upsert({ where: { chaveOperacao: fato.chave }, update: {}, create: {
      pedidoId: c.pedidoId, tipo: fato.situacao === "PAGA" ? "ASAAS_PAGAMENTO_CONFIRMADO" : "ASAAS_COBRANCA_ATUALIZADA", chaveOperacao: fato.chave, hashOperacao: hash([c.id, fato.situacao]),
      usuarioId: fato.autor.userId, usuarioNome: fato.autor.nome, versaoAnterior: pedido.versao, versaoNova: pedido.versao,
      depois: { cobrancaId: c.id, origem: c.origem, de: c.situacao, para: fato.situacao, valor: c.valor.toFixed(2), liquido: atual.valorLiquido?.toFixed(2) ?? null, baixaFinanceira: false },
    } });
  }
  return atual;
}

/** QR Code sob demanda: não é guardado, pois muda quando a cobrança é atualizada. */
export async function pixCobrancaAsaas(cobrancaValor: unknown, sessao: SessaoAtual) {
  if (!asaasAtivo()) throw new ErroAsaas("A integração com o Asaas está desativada no servidor.");
  const cobrancaId = identificador(cobrancaValor);
  const c = await prisma.$transaction(async tx => {
    const c = await tx.cobrancaAsaas.findUnique({ where: { id: cobrancaId } });
    if (!c) throw new ErroAsaas("Cobrança não encontrada.");
    await conferirAcesso(tx, sessao, ["consultar"], c.pedidoId);
    return c;
  });
  if (c.estado !== "ATIVA" || !c.asaasId || c.ambiente !== ambienteAsaas() || !["AGUARDANDO", "VENCIDA"].includes(c.situacao) || c.forma === "CARTAO_CREDITO") throw new ErroAsaas("Pix indisponível para esta cobrança.");
  const r = objeto(await chamarAsaas(c.ambiente as AmbienteAsaas, `/payments/${c.asaasId}/pixQrCode`));
  const copiaCola = texto(r.payload, 2000), imagem = typeof r.encodedImage === "string" && r.encodedImage.length < 400000 && /^[A-Za-z0-9+/=\s]+$/.test(r.encodedImage) ? r.encodedImage.replace(/\s/g, "") : "";
  if (!copiaCola) throw new ErroAsaas("O Asaas não devolveu o código Pix desta cobrança.");
  return { copiaCola, imagem: imagem ? `data:image/png;base64,${imagem}` : null, expiraEm: texto(r.expirationDate, 30) || null };
}

/** Worker: resolve envios interrompidos ou de resposta incerta consultando a referência única. */
export async function reconciliarCobrancasIncertas() {
  if (!asaasAtivo()) return 0;
  const ambiente = ambienteAsaas();
  const pendentes = await prisma.cobrancaAsaas.findMany({ where: { ambiente, origem: "HUB", OR: [{ estado: "INCERTA" }, { estado: "ENVIANDO", createdAt: { lt: new Date(Date.now() - 120000) } }] }, orderBy: { createdAt: "asc" }, take: 10, include: { pedido: { select: { numero: true } } } });
  for (const c of pendentes) {
    try {
      const referencia = referenciaHub(c.pedido.numero, c.id);
      const lista = objeto(await chamarAsaas(ambiente, "/payments", { consulta: { externalReference: referencia, limit: "10" } })).data;
      const achado = (Array.isArray(lista) ? lista : []).map(v => { try { return lerPagamento(v); } catch { return null; } }).find(p => p?.referencia === referencia && !p.removida);
      const autor = await prisma.usuario.findUnique({ where: { id: c.criadoPorId }, select: { id: true, nome: true } });
      if (achado && autor) await prisma.$transaction(tx => ativar(tx, c.id, achado, { userId: autor.id, nome: autor.nome }));
      else if (!achado && Date.now() - c.createdAt.getTime() > 600000) await prisma.cobrancaAsaas.updateMany({ where: { id: c.id, estado: { in: ["INCERTA", "ENVIANDO"] } }, data: { estado: "FALHOU", erro: "O Asaas não registrou esta cobrança. Nenhum valor foi cobrado; gere novamente." } });
    } catch { /* indisponibilidade: nova conferência no próximo ciclo */ }
  }
  return pendentes.length;
}
