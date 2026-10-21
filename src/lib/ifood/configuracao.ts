import "server-only";
import { validarFinanceiroConfigIfood } from "./financeiro-config";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { acessoIfood, exigirConta } from "./acesso";
import { ErroIfood, objeto, texto, uuid } from "./dominio";
import { credenciais, requisicaoAutorizada } from "./tokens";
import { exigirComandoLoja, recepcaoPermitida } from "./acompanhamento";

export function transporteAtivo(ambiente: string) {
  return process.env.IFOOD_ATIVO === "1" && (ambiente === "TESTE" || process.env.IFOOD_PRODUCAO_AUTORIZADA === "1");
}
export async function configurarIntegracao(entrada: { ambiente: string; modalidade: string }, sessao: SessaoAtual) {
  if (!["TESTE", "PRODUCAO"].includes(entrada.ambiente) || !["CENTRALIZADO", "DISTRIBUIDO"].includes(entrada.modalidade)) throw new ErroIfood("Confira ambiente e modalidade autorizados no Portal iFood.");
  const clientId = process.env[`IFOOD_${entrada.ambiente}_CLIENT_ID`];
  if (!clientId) throw new ErroIfood("Cadastre o aplicativo no iFood e configure as credenciais no servidor.");
  credenciais(entrada.ambiente, clientId);
  return prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    const existente = await tx.integracaoIfood.findUnique({ where: { ambiente: entrada.ambiente } });
    if (existente && (existente.clientId !== clientId || existente.modalidade !== entrada.modalidade)) throw new ErroIfood("Mudança de aplicativo/modalidade exige reconexão administrativa; preserve os vínculos existentes.");
    const i = await tx.integracaoIfood.upsert({ where: { ambiente: entrada.ambiente }, update: {}, create: { ...entrada, clientId, criadoPorId: sessao.userId } });
    return { id: i.id };
  });
}
export async function listarMerchants(integracaoId: string, sessao: SessaoAtual) {
  await prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    exigirConta((await tx.integracaoIfood.findUniqueOrThrow({ where: { id: integracaoId } })).contaId);
  });
  const lojas: { id: string; nome: string }[] = [];
  for (let page = 1; page <= 100; page++) {
    const r = await requisicaoAutorizada(integracaoId, `/merchant/v1.0/merchants?page=${page}&size=100`);
    if (!Array.isArray(r.dados)) throw new ErroIfood("Listagem de lojas fora do contrato.");
    for (const v of r.dados) { const m = objeto(v); lojas.push({ id: uuid(m.id), nome: texto(m.name, 200) }); }
    if (r.dados.length < 100) return lojas;
  }
  throw new ErroIfood("Listagem excedeu o limite local; nenhum vínculo alterado.");
}
export async function vincularLoja(integracaoId: string, merchantId: string, canalId: string, sessao: SessaoAtual) {
  uuid(merchantId);
  const autorizadas = await listarMerchants(integracaoId, sessao);
  const merchant = autorizadas.find(m => m.id === merchantId);
  if (!merchant) throw new ErroIfood("Loja ausente da autorização efetiva. Confira permissões e aguarde propagação no iFood.");
  return prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    const i = await tx.integracaoIfood.findUniqueOrThrow({ where: { id: integracaoId } }); exigirConta(i.contaId);
    const canal = await tx.canalVenda.findUnique({ where: { id: canalId } });
    if (!canal) throw new ErroIfood("Escolha um canal de venda ativo já cadastrado.");
    const existente = await tx.lojaIfood.findUnique({ where: { ambiente_merchantId: { ambiente: i.ambiente, merchantId } } });
    if (existente && existente.integracaoId !== i.id) throw new ErroIfood("Loja vinculada a outra integração.");
    const loja = await tx.lojaIfood.upsert({ where: { ambiente_merchantId: { ambiente: i.ambiente, merchantId } }, update: { autorizada: true, ultimaAutorizacao: new Date(), ultimoErro: null }, create: { integracaoId: i.id, ambiente: i.ambiente, merchantId, nome: merchant.nome, canalId, autorizada: true, ultimaAutorizacao: new Date() } });
    return { id: loja.id };
  });
}
export async function ativarLoja(lojaId: string, ativa: boolean, sessao: SessaoAtual) {
  await prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    await tx.$queryRaw`SELECT id FROM "LojaIfood" WHERE id=${lojaId} FOR UPDATE`;
    const l = await tx.lojaIfood.findUniqueOrThrow({ where: { id: lojaId }, include: { integracao: true } }); exigirConta(l.integracao.contaId);
    if (ativa && (!l.autorizada || !recepcaoPermitida(l))) throw new ErroIfood("Ativação exige autorização da loja, liberação de recepção no servidor e, no acompanhamento, janela e referências oficiais válidas.");
    await tx.lojaIfood.update({ where: { id: lojaId }, data: { ativa } });
    await tx.integracaoIfood.update({ where: { id: l.integracaoId }, data: { ativo: true } });
    await tx.historicoCadastroVenda.create({ data: { entidade: "IFOOD", registroId: l.id, usuarioId: sessao.userId, usuarioNome: sessao.nome, depois: { ativa, ambiente: l.ambiente } } });
  });
}
export async function prepararAcompanhamento(lojaId: string, entrada: { principalClientId: string; enquadramento: string; presenca: string; minutos: number; chave: string }, sessao: SessaoAtual) {
  const principalClientId = uuid(entrada.principalClientId), chave = uuid(entrada.chave);
  const referencia = (v: string) => {
    if (typeof v !== "string" || !/^[A-Za-z0-9._:/ -]{1,80}$/.test(v) || !v.trim()) throw new ErroIfood("Informe referências oficiais de até 80 caracteres, sem dados pessoais ou segredos.");
    return v.trim();
  };
  const enquadramento = referencia(entrada.enquadramento), presenca = referencia(entrada.presenca);
  const minutos = entrada.minutos;
  if (!Number.isSafeInteger(minutos) || minutos < 1 || minutos > 120) throw new ErroIfood("Informe uma janela inteira de 1 a 120 minutos. Esta limitação é interna ao piloto.");
  const hash = createHash("sha256").update(JSON.stringify({ lojaId, principalClientId, enquadramento, presenca, minutos })).digest("hex");
  return prisma.$transaction(async tx => {
    const autor = await acessoIfood(tx, sessao, undefined, true);
    await tx.$queryRaw`SELECT id FROM "LojaIfood" WHERE id=${lojaId} FOR UPDATE`;
    const l = await tx.lojaIfood.findUniqueOrThrow({ where: { id: lojaId }, include: { integracao: true } }); exigirConta(l.integracao.contaId);
    const anterior = await tx.historicoCadastroVenda.findUnique({ where: { id: chave } });
    if (anterior) { if (anterior.registroId !== lojaId || anterior.usuarioId !== autor.id || objeto(anterior.depois).hash !== hash) throw new ErroIfood("Chave utilizada com outros dados."); return; }
    if (l.ativa || l.leaseAte && l.leaseAte > new Date()) throw new ErroIfood("Pause a recepção e aguarde o coletor antes de preparar o acompanhamento.");
    if (principalClientId === l.integracao.clientId.toLowerCase()) throw new ErroIfood("O acompanhamento exige aplicativo/credencial diferente do sistema principal.");
    if (await tx.pedidoIfood.count({ where: { lojaId, acompanhamento: false } }) || await tx.acaoMerchantIfood.count({ where: { lojaId, estado: { in: ["PENDENTE", "ENVIANDO", "INCERTA", "AGUARDANDO_CONFERENCIA", "INTERVENCAO"] } } })) throw new ErroIfood("O vínculo contém operação anterior ou ações pendentes. Não é possível convertê-lo em acompanhamento.");
    // Prazo do servidor, congelado na primeira gravação; retry da chave não o estende.
    const ate = new Date(Date.now() + minutos * 60000);
    await tx.lojaIfood.update({ where: { id: lojaId }, data: { modoOperacao: "ACOMPANHAMENTO", pilotoAte: ate, principalClientId, pilotoEnquadramentoReferencia: enquadramento, pilotoPresencaReferencia: presenca } });
    await tx.historicoCadastroVenda.create({ data: { id: chave, entidade: "IFOOD_ACOMPANHAMENTO", registroId: lojaId, usuarioId: autor.id, usuarioNome: autor.nome, depois: { hash, minutos, ate: ate.toISOString(), enquadramento, presenca, modo: "ACOMPANHAMENTO", ativa: false } } });
  });
}
export async function consultarEstadoLoja(lojaId: string, sessao: SessaoAtual) {
  const loja = await prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    const l = await tx.lojaIfood.findUniqueOrThrow({ where: { id: lojaId }, include: { integracao: true } });
    exigirConta(l.integracao.contaId);
    if (!l.autorizada || !recepcaoPermitida(l)) throw new ErroIfood("Confira a autorização e a liberação deste ambiente.");
    return l;
  });
  const r = await requisicaoAutorizada(loja.integracaoId, `/merchant/v1.0/merchants/${loja.merchantId}/status`);
  if (!Array.isArray(r.dados)) throw new ErroIfood("Estado da loja fora do contrato.");
  const estados: Record<string, string> = { OK: "Disponível", WARNING: "Com restrições", CLOSED: "Fechada", ERROR: "Com erro", UNAVAILABLE: "Indisponível" };
  return { consultadoEm: new Date().toISOString(), operacoes: r.dados.map(v => {
    const d = objeto(v), estado = texto(d.state, 40);
    if (typeof d.available !== "boolean") throw new ErroIfood("Disponibilidade da loja fora do contrato.");
    return { operacao: texto(d.operation, 40), canal: texto(d.salesChannel, 40), estado: estados[estado] ?? "Estado desconhecido", disponivel: d.available, validacoes: (Array.isArray(d.validations) ? d.validations : []).map(v => { const a=objeto(v); return { id:texto(a.id,100), codigo:texto(a.code,100), estado:estados[texto(a.state,40)]??"Estado desconhecido" }; }) };
  }) };
}
export async function consultarIntegracoes(sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    const integracoes = await tx.integracaoIfood.findMany({ where: { contaId: "singleton" }, select: { id: true, clientId: true, ambiente: true, modalidade: true, ativo: true, tokenExpiraEm: true, ultimoErro: true, lojas: { select: { id: true, modoOperacao: true, pilotoAte: true, principalClientId: true, pilotoEnquadramentoReferencia: true, pilotoPresencaReferencia: true, merchantId: true, nome: true, financeiroConfig: true, versaoFinanceiroConfig: true, autorizada: true, ativa: true, ultimoPolling: true, ultimoRecebimento: true, ultimoErro: true, eventos: { where: { estado: { in: ["PENDENTE", "FALHOU", "DESCONHECIDO"] } }, select: { recebidoEm: true, estado: true } }, acoesMerchant: { where: { estado: { in: ["INCERTA", "ENVIANDO", "AGUARDANDO_CONFERENCIA", "INTERVENCAO"] } }, select: { id: true } }, pedidos: { select: { financeiroPendente: true, acoes: { where: { estado: { in: ["INCERTA", "ENVIANDO", "AGUARDANDO_EVENTO"] } }, select: { id: true } } } } } } } });
    return integracoes.map(i => ({ id: i.id, ambiente: i.ambiente, modalidade: i.modalidade, transporteLiberado: transporteAtivo(i.ambiente), autenticada: !!i.tokenExpiraEm && i.tokenExpiraEm > new Date(), ultimoErro: i.ultimoErro,
      lojas: i.lojas.map(l => ({ acompanhamento: l.modoOperacao === "ACOMPANHAMENTO", pilotoAte: l.pilotoAte?.toISOString() ?? null, recepcaoLiberada: recepcaoPermitida({ ...l, ambiente: i.ambiente, integracao: { clientId: i.clientId } }), financeiroConfig: l.financeiroConfig as import("./financeiro-config").FinanceiroConfigIfood | null, versaoFinanceiroConfig: l.versaoFinanceiroConfig, id: l.id, merchantId: l.merchantId, nome: l.nome, autorizada: l.autorizada, ativa: l.ativa, ultimoPolling: l.ultimoPolling?.toISOString() ?? null, ultimoRecebimento: l.ultimoRecebimento?.toISOString() ?? null, erro: l.ultimoErro, pendentes: l.eventos.length, falhas: l.eventos.filter(e => e.estado === "FALHOU").length, maisAntiga: l.eventos.length ? new Date(Math.min(...l.eventos.map(e => e.recebidoEm.getTime()))).toISOString() : null, reconciliacoes: l.acoesMerchant.length + l.pedidos.reduce((n, p) => n + p.acoes.length, 0) })) }));
  });
}

export async function renovarAutorizacao(integracaoId: string, sessao: SessaoAtual) {
  await prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    const i = await tx.integracaoIfood.findUniqueOrThrow({ where: { id: integracaoId } }); exigirConta(i.contaId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-token:" + integracaoId}))`;
    await tx.integracaoIfood.update({ where: { id: i.id }, data: { tokenExpiraEm: new Date(0) } });
  });
  const lojas = await listarMerchants(integracaoId, sessao);
  await prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    await tx.lojaIfood.updateMany({ where: { integracaoId, merchantId: { notIn: lojas.map(l => l.id) } }, data: { autorizada: false, ultimoErro: "Loja ausente da autorização efetiva" } });
    await tx.lojaIfood.updateMany({ where: { integracaoId, merchantId: { in: lojas.map(l => l.id) } }, data: { autorizada: true, ultimaAutorizacao: new Date(), ultimoErro: null } });
  });
  return lojas;
}
export async function retomarEventos(lojaId: string, sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    const autor = await acessoIfood(tx, sessao, undefined, true);
    const l = await tx.lojaIfood.findUniqueOrThrow({ where: { id: lojaId }, include: { integracao: true } }); exigirConta(l.integracao.contaId);
    if (!l.autorizada || !l.ativa || !recepcaoPermitida(l)) throw new ErroIfood("Restabeleça a autorização e a recepção antes de retomar.");
    const r = await tx.eventoIfood.updateMany({ where: { lojaId, estado: "FALHOU" }, data: { estado: "PENDENTE", tentativas: 0, proximaTentativa: new Date(), erro: null } });
    await tx.historicoCadastroVenda.create({ data: { entidade: "IFOOD", registroId: lojaId, usuarioId: autor.id, usuarioNome: autor.nome, depois: { acao: "RETOMAR_EVENTOS", quantidade: r.count } } });
    return r.count;
  });
}

export async function salvarFinanceiroConfigIfood(lojaId: string, versao: number, entrada: unknown, chave: string, sessao: SessaoAtual) {
  const valor = validarFinanceiroConfigIfood(entrada);
  if (!Number.isSafeInteger(versao) || versao < 1 || !/^[a-zA-Z0-9_-]{16,100}$/.test(chave)) throw new ErroIfood("Revisão ou chave inválida.");
  const hash = createHash("sha256").update(JSON.stringify({ lojaId, versao, valor })).digest("hex");
  await prisma.$transaction(async tx => {
    const autor = await acessoIfood(tx, sessao, "financeiro.movimentacoes", true);
    await exigirComandoLoja(tx, lojaId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-config-financeiro:" + lojaId}))`;
    const loja = await tx.lojaIfood.findUniqueOrThrow({ where: { id: lojaId }, include: { integracao: true } }); exigirConta(loja.integracao.contaId);
    const anterior = await tx.historicoCadastroVenda.findFirst({ where: { entidade: "IFOOD_FINANCEIRO", registroId: lojaId, depois: { path: ["chave"], equals: chave } } });
    if (anterior) { if (objeto(anterior.depois).hash !== hash || anterior.usuarioId !== autor.id) throw new ErroIfood("Esta chave já foi usada com outros dados."); return; }
    if (loja.versaoFinanceiroConfig !== versao) throw new ErroIfood("Configuração alterada. Reabra antes de salvar.");
    const ids = [...new Set(Object.values(valor.formas))];
    if (await tx.formaPagamentoVenda.count({ where: { id: { in: ids }, ativo: true } }) !== ids.length) throw new ErroIfood("Forma financeira indisponível no cadastro.");
    await tx.lojaIfood.update({ where: { id: lojaId }, data: { financeiroConfig: valor, versaoFinanceiroConfig: { increment: 1 } } });
    await tx.historicoCadastroVenda.create({ data: { entidade: "IFOOD_FINANCEIRO", registroId: lojaId, usuarioId: autor.id, usuarioNome: autor.nome, antes: { configuracao: loja.financeiroConfig }, depois: { configuracao: valor, chave, hash } } });
  });
  await reavaliarFinanceiroPendenteIfood(lojaId, sessao);
}

/** Recuperação pelo cadastro, usando somente snapshots e serviços locais. Sem chamadas remotas. */
async function reavaliarFinanceiroPendenteIfood(lojaId: string, sessao: SessaoAtual) {
  const { adaptarPedido } = await import("./adaptador");
  const { decifrarIfood } = await import("./tokens");
  const { projetarFinanceiro } = await import("./financeiro");
  let cursor: string | undefined;
  for (;;) {
    const candidatos = await prisma.pedidoIfood.findMany({ where: { lojaId, financeiroPendente: true, revisaoPendente: false, loja: { ambiente: "PRODUCAO" }, pedido: { status: "CONFIRMADO" } }, select: { id: true }, orderBy: { id: "asc" }, take: 50, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!candidatos.length) break;
    for (const candidato of candidatos) await prisma.$transaction(async tx => {
      await acessoIfood(tx, sessao, "financeiro.movimentacoes", true);
      const origem = await tx.pedidoIfood.findUniqueOrThrow({ where: { id: candidato.id }, select: { lojaId: true, externoId: true } });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-pedido:" + origem.lojaId + ":" + origem.externoId}))`;
      const p = await tx.pedidoIfood.findUniqueOrThrow({ where: { id: candidato.id }, include: { pedido: true, loja: { include: { integracao: true } } } });
      exigirConta(p.loja.integracao.contaId);
      if (!p.financeiroPendente || p.revisaoPendente || p.pedido.status !== "CONFIRMADO") return;
      await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${p.pedidoId} FOR UPDATE`;
      let adaptado;
      try { adaptado = adaptarPedido(decifrarIfood(p.snapshotCifrado), p.loja.merchantId, p.loja.ambiente, p.pedido.fusoHorario); }
      catch { return; } // Divergência do snapshot continua visível, sem impedir salvar a configuração.
      const pendencia = await projetarFinanceiro(tx, p.pedidoId, adaptado, false);
      await tx.pedidoIfood.update({ where: { id: p.id }, data: { financeiroPendente: !!pendencia, pendencia: pendencia ?? (adaptado.pendencias.length ? adaptado.pendencias.join("; ") : null) } });
    }, { timeout: 30000 });
    cursor = candidatos.at(-1)!.id;
  }
}
