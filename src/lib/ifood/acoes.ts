import { exigirComandoLoja, exigirEfeitoOperacional } from "./acompanhamento";
import { pedidoEmAcompanhamento } from "./acompanhamento-dominio";
import "server-only";
import { lerNegociacaoIfood, corpoNegociacaoIfood, type EntradaAcaoIfood } from "./negociacao";
import { horariosPedidoIfood } from "./horarios";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { acessoIfood, exigirConta, recursoAcao } from "./acesso";
import { acoesPermitidas, ErroIfood, instante, objeto, texto, uuid, type AcaoIfoodNome } from "./dominio";
import { requisicaoAutorizada, cifrarIfood, decifrarIfood } from "./tokens";
import { FalhaHttpIfood } from "./cliente";
import { hashIfood } from "./processamento";
import { adaptarPedido } from "./adaptador";
import { obrigacoesFinanceirasIfood } from "./financeiro";
import { transporteAtivo } from "./configuracao";

function limiteConfirmacao(cifra: string) {
  const p = objeto(decifrarIfood(cifra));
  const base = p.orderTiming === "SCHEDULED" ? p.preparationStartDateTime : p.createdAt;
  return base ? new Date(instante(base).getTime() + 8 * 60000) : null;
}
function negociacao(cifra: string | null) {
  if (!cifra) return null;
  return lerNegociacaoIfood(decifrarIfood(cifra));
}
const emAberto = ["PENDENTE", "ENVIANDO", "INCERTA", "AGUARDANDO_EVENTO"];
export async function consultarPedidoIfood(pedidoId: string, sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, "vendas.pedidos", false, false);
    const p = await tx.pedidoIfood.findUnique({ where: { pedidoId }, include: { pedido: { include: { itens: { where: { vigente: true } }, historico: { where: { tipo: { in: ["IFOOD_EVENTO", "IFOOD_CONFERENCIA", "IFOOD_RECONCILIACAO", "IFOOD_ACAO_SOLICITADA"] } }, orderBy: { createdAt: "desc" }, take: 50 } } }, loja: { include: { integracao: true } }, acoes: { orderBy: { createdAt: "desc" }, take: 20 } } });
    if (!p) return null; exigirConta(p.loja.integracao.contaId);
    const aberta = await tx.acaoIfood.count({ where: { pedidoIfoodId: p.id, estado: { in: emAberto } } }) > 0;
    const acompanhamento = pedidoEmAcompanhamento(p);
    const todas = acompanhamento ? [] : acoesPermitidas({ estado: p.estadoRemoto, modalidade: p.modalidade, entregaPor: p.entregaPor, inicioPreparo: p.inicioPreparo, pendente: aberta, autorizada: p.loja.autorizada && p.loja.ativa && p.loja.integracao.ativo && transporteAtivo(p.loja.ambiente), disputaId: p.disputaId, disputaAte: p.disputaAte, disputaCompativel: negociacao(p.disputaCifrada)?.compativel, disputaAlternativas: !!negociacao(p.disputaCifrada)?.alternativas.length, revisaoPendente: p.revisaoPendente || horariosPedidoIfood(decifrarIfood(p.snapshotCifrado), p.pedido.fusoHorario).problemas.length > 0, confirmarAte: limiteConfirmacao(p.snapshotCifrado) });
    const permitidas: AcaoIfoodNome[] = [];
    for (const a of todas) { try { await acessoIfood(tx, sessao, recursoAcao(a)); permitidas.push(a); } catch { /* Consulta conserva detalhes sem conceder escrita. */ } }
    let podeConferir = false;
    try { await acessoIfood(tx, sessao, "vendas.pedidos.revisar"); podeConferir = true; } catch { /* Consulta sem intervenção. */ }
    const snapshot = objeto(decifrarIfood(p.snapshotCifrado));
    const horarios = horariosPedidoIfood(snapshot, p.pedido.fusoHorario);
    const horarioInconsistente = horarios.problemas.length > 0;
    return { acompanhamento, podeConferir: podeConferir && !acompanhamento, pedidoId, numero: p.pedido.numero, versao: p.pedido.versao, ambiente: p.loja.ambiente, loja: p.loja.nome, merchantId: p.loja.merchantId, externoId: p.externoId, displayId: texto(snapshot.displayId, 100), horarioInconsistente, problemasHorarios: horarios.problemas,
      estado: p.estadoRemoto, modalidade: p.modalidade, entregaPor: p.entregaPor, inicioPreparo: p.inicioPreparo?.toISOString() ?? null,
      horarios: { agendado: horarios.agendado, entregaRetirada: horarios.entregaRetirada?.toISOString() ?? null, janelaInicio: horarios.janelaInicio?.toISOString() ?? null, janelaFim: horarios.janelaFim?.toISOString() ?? null },
      confirmarAte: limiteConfirmacao(p.snapshotCifrado)?.toISOString() ?? null, fusoHorario: p.pedido.fusoHorario, total: p.pedido.total.toFixed(2), cliente: texto(objeto(p.pedido.compradorSnapshot).nome, 300), observacoes: p.pedido.observacoes,
      endereco: p.pedido.enderecoSnapshot as Record<string, string> | null, contato: p.pedido.destinatarioSnapshot as Record<string, string> | null,
      valores: adaptarPedido(snapshot, p.loja.merchantId, p.loja.ambiente, p.pedido.fusoHorario).valores,
      obrigacoesFinanceiras: obrigacoesFinanceirasIfood(adaptarPedido(snapshot, p.loja.merchantId, p.loja.ambiente, p.pedido.fusoHorario)),
      pagamentos: p.pedido.pagamentoInformadoSnapshot as { metodos: { valor: string; metodo: string; prePago: boolean; bandeira: string | null; trocoPara: string | null }[] },
      negociacao: negociacao(p.disputaCifrada), revisaoPendente: p.revisaoPendente || horariosPedidoIfood(decifrarIfood(p.snapshotCifrado), p.pedido.fusoHorario).problemas.length > 0,
      formasFinanceiras: await tx.formaPagamentoVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
      pendencia: p.pendencia, financeiroPendente: p.financeiroPendente, autorizada: p.loja.autorizada, acoesPermitidas: permitidas,
      itens: p.pedido.itens.map(i => ({ id: i.id, nome: texto(objeto(i.produtoSnapshot).nome, 300), quantidade: i.quantidade.toString(), total: i.totalLinha.toFixed(2), observacoes: i.observacoes, vinculado: !!i.produtoId, complementos: i.escolhasSnapshot as { opcaoNome: string; quantidade: number; preco: string }[] })),
      acoes: p.acoes.map(a => ({ id: a.id, acao: a.acao, estado: a.estado, erro: a.erro, data: a.createdAt.toISOString() })),
      historico: p.pedido.historico.map(h => ({ responsavel: h.usuarioNome, data: h.createdAt.toISOString(), evento: texto(objeto(h.depois).evento, 100) || (h.tipo === "IFOOD_ACAO_SOLICITADA" ? "Ação solicitada: " + texto(objeto(h.depois).acao, 80) : h.tipo === "IFOOD_CONFERENCIA" ? "Conferência registrada · " + texto(objeto(h.depois).situacao,80) + " · " + texto(objeto(h.depois).referencia,80) : "Reconciliação com evento oficial"), aplicado: objeto(h.depois).aplicado === true })),
    };
  });
}
export async function motivosCancelamento(pedidoId: string, sessao: SessaoAtual) {
  const p = await consultarPedidoIfood(pedidoId, sessao);
  if (!p?.acoesPermitidas.includes("requestCancellation")) throw new ErroIfood("Cancelamento não permitido neste estado.");
  const externo = await prisma.pedidoIfood.findUniqueOrThrow({ where: { pedidoId }, include: { loja: true } });
  const r = await requisicaoAutorizada(externo.loja.integracaoId, `/order/v1.0/orders/${externo.externoId}/cancellationReasons`);
  if (r.status === 204) return [];
  if (!Array.isArray(r.dados)) throw new ErroIfood("Motivos fora do contrato.");
  return r.dados.map(v => { const d = objeto(v); return { codigo: texto(d.cancelCodeId, 20), descricao: texto(d.description, 300) }; });
}
export async function solicitarAcao(pedidoId: string, revisao: number, acao: AcaoIfoodNome, entrada: EntradaAcaoIfood, chave: string, sessao: SessaoAtual) {
  uuid(chave);
  if (!Number.isSafeInteger(revisao) || revisao < 1) throw new ErroIfood("Revisão inválida.");
  const resumo = hashIfood({ pedidoId, revisao, acao, entrada });
  return prisma.$transaction(async tx => {
    const autor = await acessoIfood(tx, sessao, recursoAcao(acao));
    const p = await tx.pedidoIfood.findUniqueOrThrow({ where: { pedidoId }, include: { loja: { include: { integracao: true } } } }); exigirConta(p.loja.integracao.contaId);
    await exigirComandoLoja(tx, p.lojaId);
    await exigirEfeitoOperacional(tx, p.pedidoId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-pedido:" + p.lojaId + ":" + p.externoId}))`;
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${pedidoId} FOR UPDATE`;
    const repetida = await tx.acaoIfood.findUnique({ where: { chave } });
    if (repetida) { if (repetida.hash !== resumo || repetida.pedidoIfoodId !== p.id) throw new ErroIfood("Chave já utilizada com outro conteúdo."); return { id: repetida.id }; }
    const atual = await tx.pedidoIfood.findUniqueOrThrow({ where: { id: p.id }, include: { pedido: true, acoes: { where: { estado: { in: emAberto } } } } });
    if (atual.pedido.versao !== revisao) throw new ErroIfood("O pedido mudou. Atualize antes de enviar.");
    if (!acoesPermitidas({ estado: atual.estadoRemoto, modalidade: atual.modalidade, entregaPor: atual.entregaPor, inicioPreparo: atual.inicioPreparo, pendente: atual.acoes.length > 0, autorizada: p.loja.autorizada && p.loja.ativa && p.loja.integracao.ativo && transporteAtivo(p.loja.ambiente), disputaId: atual.disputaId, disputaAte: atual.disputaAte, disputaCompativel: negociacao(atual.disputaCifrada)?.compativel, disputaAlternativas: !!negociacao(atual.disputaCifrada)?.alternativas.length, revisaoPendente: atual.revisaoPendente || horariosPedidoIfood(decifrarIfood(atual.snapshotCifrado), atual.pedido.fusoHorario).problemas.length > 0, confirmarAte: limiteConfirmacao(atual.snapshotCifrado) }).includes(acao)) throw new ErroIfood("Ação indisponível neste estado ou loja.");
    let corpo: unknown = null;
    if (acao === "requestCancellation") {
      if (!/^\d{1,10}$/.test(entrada.codigo ?? "") || !entrada.motivo?.trim() || entrada.motivo.length > 1000) throw new ErroIfood("Escolha um motivo oficial e informe a justificativa.");
      corpo = { cancellationCode: entrada.codigo, reason: entrada.motivo.trim() };
    }
    if (acao === "verifyDeliveryCode") {
      if (!/^\d{4}$/.test(entrada.codigo ?? "")) throw new ErroIfood("Informe os quatro dígitos do código de entrega.");
      corpo = { code: entrada.codigo };
    }
    if (["acceptDispute", "rejectDispute", "alternativeDispute"].includes(acao)) {
      if (!atual.disputaCifrada) throw new ErroIfood("Negociação indisponível.");
      corpo = { disputeId: atual.disputaId, alternativaId: entrada.alternativaId ?? null, payload: corpoNegociacaoIfood(decifrarIfood(atual.disputaCifrada), acao, entrada), entrada };
    }
    const a = await tx.acaoIfood.create({ data: { pedidoIfoodId: p.id, acao, revisao, chave, hash: resumo, corpoCifrado: corpo ? cifrarIfood(corpo) : null, autorId: autor.id, sessaoVersao: sessao.versao ?? 0 } });
    await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo: "IFOOD_ACAO_SOLICITADA", chaveOperacao: `ifood-acao:${a.id}`, hashOperacao: resumo, usuarioId: autor.id, usuarioNome: autor.nome, versaoAnterior: revisao, versaoNova: revisao, depois: { acao, estado: "PENDENTE" } } });
    return { id: a.id };
  });
}
export async function enviarAcao() {
  if (process.env.IFOOD_ATIVO !== "1") return false;
  const a = await prisma.$transaction(async tx => {
    const ids = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "AcaoIfood" WHERE estado='PENDENTE' AND "proximaTentativa"<=(now() AT TIME ZONE 'UTC') ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!ids.length) return null;
    // Commit ANTES de sair à rede: queda posterior exige reconciliação, nunca replay cego.
    return tx.acaoIfood.update({ where: { id: ids[0].id }, data: { estado: "ENVIANDO", enviadaEm: new Date(), tentativas: { increment: 1 } } });
  });
  if (!a) return false;
  let envioIniciado = false;
  try {
    await prisma.$transaction(async tx => {
      await acessoIfood(tx, { userId: a.autorId, versao: a.sessaoVersao }, recursoAcao(a.acao));
      if (a.origemMcpOperacaoId) {
        const { permitirEfeitoPendenteMcp } = await import("@/lib/mcp/efeito-pendente");
        if (!await permitirEfeitoPendenteMcp(tx, a.origemMcpOperacaoId, a.autorId)) throw new ErroIfood("Acesso MCP retirado antes do envio externo.");
      }
      const p = await tx.pedidoIfood.findUniqueOrThrow({ where: { id: a.pedidoIfoodId }, include: { loja: { include: { integracao: true } }, pedido: true } }); exigirConta(p.loja.integracao.contaId);
      await exigirComandoLoja(tx, p.lojaId);
      await exigirEfeitoOperacional(tx, p.pedidoId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-pedido:" + p.lojaId + ":" + p.externoId}))`;
      const atual = await tx.pedidoIfood.findUniqueOrThrow({ where: { id: p.id }, include: { pedido: true } });
      if (atual.pedido.versao !== a.revisao || !acoesPermitidas({ estado: atual.estadoRemoto, modalidade: atual.modalidade, entregaPor: atual.entregaPor, inicioPreparo: atual.inicioPreparo, pendente: false, autorizada: p.loja.ativa && p.loja.autorizada && p.loja.integracao.ativo && transporteAtivo(p.loja.ambiente), disputaId: atual.disputaId, disputaAte: atual.disputaAte, disputaCompativel: negociacao(atual.disputaCifrada)?.compativel, disputaAlternativas: !!negociacao(atual.disputaCifrada)?.alternativas.length, revisaoPendente: atual.revisaoPendente || horariosPedidoIfood(decifrarIfood(atual.snapshotCifrado), atual.pedido.fusoHorario).problemas.length > 0, confirmarAte: limiteConfirmacao(atual.snapshotCifrado) }).includes(a.acao as AcaoIfoodNome)) throw new ErroIfood("Estado/autorização mudou antes do envio.");
      const corpo = a.corpoCifrado ? objeto(decifrarIfood(a.corpoCifrado)) : null;
      if (a.acao === "requestCancellation") {
        const motivos = await requisicaoAutorizada(p.loja.integracaoId, `/order/v1.0/orders/${p.externoId}/cancellationReasons`);
        if (!Array.isArray(motivos.dados) || !motivos.dados.some(m => objeto(m).cancelCodeId === corpo?.cancellationCode)) throw new ErroIfood("Motivo não está disponível no iFood.");
      }
      const disputa = ["acceptDispute", "rejectDispute", "alternativeDispute"].includes(a.acao);
      if (disputa && corpo?.disputeId !== atual.disputaId) throw new ErroIfood("A negociação mudou.");
      let payload = corpo ?? undefined;
      if (disputa) {
        if (!atual.disputaCifrada || !corpo) throw new ErroIfood("Negociação mudou.");
        const validado = corpoNegociacaoIfood(decifrarIfood(atual.disputaCifrada), a.acao, corpo.entrada as EntradaAcaoIfood);
        if (hashIfood(validado) !== hashIfood(corpo.payload)) throw new ErroIfood("Opções da negociação mudaram.");
        payload = validado ?? undefined;
      }
      const caminho = disputa ? "/order/v1.0/disputes/" + uuid(corpo?.disputeId) + "/" + (a.acao === "alternativeDispute" ? "alternatives/" + uuid(corpo?.alternativaId) : a.acao === "acceptDispute" ? "accept" : "reject") : "/order/v1.0/orders/" + p.externoId + "/" + a.acao;
      envioIniciado = true;
      const r = await requisicaoAutorizada(p.loja.integracaoId, caminho, { metodo: "POST", corpo: payload });
      if (a.acao === "verifyDeliveryCode" && (r.status !== 200 || objeto(r.dados).success !== true)) throw new ErroIfood("Código de entrega não confirmado pelo iFood.");
      if (a.acao !== "verifyDeliveryCode" && r.status !== (disputa ? 201 : 202)) throw new FalhaHttpIfood(0);
      await tx.acaoIfood.update({ where: { id: a.id }, data: { estado: "AGUARDANDO_EVENTO", erro: null } });
    }, { timeout: 45000, maxWait: 10000 });
  } catch (e) {
    const http = e instanceof FalhaHttpIfood;
    const incerta = envioIniciado && (!(e instanceof ErroIfood) || http && (e.status === 0 || e.status >= 500));
    const repetir = http && e.status === 429 && a.tentativas < 5;
    await prisma.$transaction(async tx => {
      const salvo = await tx.acaoIfood.updateMany({ where: { id: a.id, estado: "ENVIANDO" }, data: { estado: incerta ? "INCERTA" : repetir ? "PENDENTE" : "RECUSADA", erro: e instanceof ErroIfood ? e.message : "Falha local; conferir reconciliação antes de novo envio", proximaTentativa: new Date(Date.now() + (http ? e.esperaMs : 30000)) } });
      // Resposta definitiva permite corrigir dados em nova revisão; incerteza nunca libera replay.
      if (salvo.count && !incerta && !repetir) await tx.pedidoVenda.updateMany({ where: { ifood: { id: a.pedidoIfoodId }, versao: a.revisao }, data: { versao: { increment: 1 } } });
    });
    if (http && [401, 403].includes(e.status)) {
      const p = await prisma.pedidoIfood.findUniqueOrThrow({ where: { id: a.pedidoIfoodId } });
      await prisma.lojaIfood.update({ where: { id: p.lojaId }, data: { autorizada: false, ultimoErro: e.message } });
    }
  }
  return true;
}
