import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolverClienteCanonico } from "@/lib/vendas/clientes-unicidade";
import { confirmacaoAcaoIfood } from "./confirmacao-acao";
import { adaptarPedido } from "./adaptador";
import { ErroIfood, ESTADOS, estadoInterno, objeto, proximoEstado, uuid, instante, type EventoRemoto } from "./dominio";
import { requisicaoAutorizada, cifrarIfood, decifrarIfood } from "./tokens";
import { FalhaHttpIfood } from "./cliente";
import { projetarFinanceiro } from "./financeiro";
import { filtroRecepcaoSql, recepcaoPermitida } from "./acompanhamento";
import { pedidoEmAcompanhamento, ROTULO_ACOMPANHAMENTO_IFOOD } from "./acompanhamento-dominio";
import { exigirConta } from "./acesso";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export const hashIfood = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export async function persistirEventos(lojaId: string, eventos: EventoRemoto[]) {
  await prisma.$transaction(async tx => {
    const loja = await tx.lojaIfood.findUniqueOrThrow({ where: { id: lojaId }, include: { integracao: true } });
    exigirConta(loja.integracao.contaId);
    if (eventos.some(e => e.merchantId !== loja.merchantId)) throw new ErroIfood("Evento fora da loja.");
    await tx.eventoIfood.createMany({ skipDuplicates: true, data: eventos.map(e => ({ id: randomUUID(), lojaId, externoId: e.id, pedidoExternoId: e.orderId, codigo: e.code, codigoCompleto: e.fullCode, ocorridoEm: e.createdAt, metadataCifrada: cifrarIfood(e.metadata) })) });
    if (eventos.length) await tx.lojaIfood.update({ where: { id: lojaId }, data: { ultimoRecebimento: new Date() } });
  });
}
export async function processarEvento() {
  if (process.env.IFOOD_ATIVO !== "1") return false;
  let eventoId: string | undefined;
  try {
    return await prisma.$transaction(async tx => {
      const candidatos = await tx.$queryRaw<{ id: string }[]>`SELECT e.id FROM "EventoIfood" e JOIN "LojaIfood" l ON l.id=e."lojaId" JOIN "IntegracaoIfood" i ON i.id=l."integracaoId" WHERE e.estado='PENDENTE' AND e."proximaTentativa"<=(now() AT TIME ZONE 'UTC') AND l.autorizada=true AND l.ativa AND i.ativo AND i."contaId"='singleton' AND ${filtroRecepcaoSql()} ORDER BY e."ocorridoEm",e.id LIMIT 1 FOR UPDATE OF e SKIP LOCKED`;
      if (!candidatos.length) return false;
      eventoId = candidatos[0].id;
      // Serializar com pausa/preparação sem pular o segundo evento concorrente da loja.
      await tx.$queryRaw`SELECT l.id FROM "LojaIfood" l JOIN "EventoIfood" e ON e."lojaId"=l.id WHERE e.id=${eventoId} FOR UPDATE OF l`;
      const e = await tx.eventoIfood.findUniqueOrThrow({ where: { id: eventoId }, include: { loja: { include: { integracao: true } } } });
      if (!e.loja.ativa || !e.loja.autorizada || !recepcaoPermitida(e.loja)) return false;
      if (!e.pedidoExternoId) { await tx.eventoIfood.update({ where: { id: e.id }, data: { estado: "DESCONHECIDO", erro: "Evento sem pedido preservado para diagnóstico" } }); return true; }
      // Uma trava por pedido serializa eventos diferentes e a criação da identidade interna.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-pedido:" + e.lojaId + ":" + e.pedidoExternoId}))`;
      let externo = await tx.pedidoIfood.findUnique({ where: { lojaId_externoId: { lojaId: e.lojaId, externoId: e.pedidoExternoId } } });
      const conhecido = ESTADOS[e.codigo as keyof typeof ESTADOS] === e.codigoCompleto;
      if (!conhecido && ({ HSD: "HANDSHAKE_DISPUTE", HSS: "HANDSHAKE_SETTLEMENT", CAR: "CANCELLATION_REQUESTED", CARF: "CANCELLATION_REQUEST_FAILED", OPA: "ORDER_PATCHED" } as Record<string,string>)[e.codigo] !== e.codigoCompleto) {
        await tx.eventoIfood.update({ where: { id: e.id }, data: { estado: "DESCONHECIDO", erro: "Evento preservado; nenhuma transição aplicada" } }); return true;
      }
      const config = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
      const fuso = config?.fusoHorario ?? "America/Sao_Paulo";
      if (!externo) {
        const recebido = (await requisicaoAutorizada(e.loja.integracaoId, `/order/v1.0/orders/${uuid(e.pedidoExternoId)}`, { lojaId: e.lojaId })).dados;
        const p = adaptarPedido(recebido, e.loja.merchantId, e.loja.ambiente, fuso);
        if (p.externoId !== e.pedidoExternoId) throw new ErroIfood("Identidade do pedido divergente.");
        const chaves = p.itens.map(i => i.externoId);
        const vinculos = await tx.identidadeExternaVenda.findMany({ where: { origem: "IFOOD", loja: `${e.loja.ambiente}:${e.loja.merchantId}`, entidade: "PRODUTO", chave: { in: chaves } } });
        const produtos = await tx.produtoVenda.findMany({ where: { id: { in: vinculos.map(v => v.destinoId) } }, select: { id: true } });
        const clienteVinculo = p.clienteExternoId ? await tx.identidadeExternaVenda.findUnique({ where: { origem_loja_entidade_chave: { origem: "IFOOD", loja: `${e.loja.ambiente}:${e.loja.merchantId}`, entidade: "CLIENTE", chave: p.clienteExternoId } } }) : null;
        const clienteId = clienteVinculo ? await resolverClienteCanonico(tx, clienteVinculo.destinoId) : null;
        const chave = `ifood:${e.loja.ambiente}:${e.loja.merchantId}:${p.externoId}`;
        const pedido = await tx.pedidoVenda.create({ data: {
          ...p.dados, enderecoSnapshot: p.dados.enderecoSnapshot ?? Prisma.DbNull, modoFinanceiro: e.loja.modoOperacao === "ACOMPANHAMENTO" ? "EXTERNO" : "HUB", versaoFinanceiro: 1, status: "RECEBIDO_EXTERNO",
          fusoHorario: fuso, clienteId, canalId: e.loja.canalId, canalNomeSnapshot: e.loja.modoOperacao === "ACOMPANHAMENTO" ? ROTULO_ACOMPANHAMENTO_IFOOD : e.loja.ambiente === "TESTE" ? "iFood · Teste" : "iFood", chaveCriacao: chave, hashCriacao: hashIfood(p.snapshot),
          referenciaOrigem: "IFOOD", referenciaEstabelecimento: `${e.loja.ambiente}:${e.loja.merchantId}`, referenciaPedido: p.externoId, criadoPorId: e.loja.integracao.criadoPorId,
          itens: { create: p.itens.map(({ externoId, externalCode, ...i }) => {
            void externalCode;
            const destino = vinculos.find(v => v.chave === externoId)?.destinoId;
            return { ...i, escolhasSnapshot: json(i.escolhasSnapshot), versaoPedido: 1, produtoId: produtos.find(v => v.id === destino)?.id ?? null };
          }) },
        } });
        externo = await tx.pedidoIfood.create({ data: { acompanhamento: e.loja.modoOperacao === "ACOMPANHAMENTO", financeiroPendente: e.loja.modoOperacao !== "ACOMPANHAMENTO", lojaId: e.lojaId, externoId: p.externoId, pedidoId: pedido.id, modalidade: p.modalidade, entregaPor: p.entregaPor, revisaoPendente: p.horarios.problemas.length > 0, inicioPreparo: p.inicioPreparo, snapshotCifrado: cifrarIfood(p.snapshot), pendencia: p.pendencias.join("; ") || null } });
      }
      await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${externo.pedidoId} FOR UPDATE`;
      const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: externo.pedidoId } });
      const proximo = proximoEstado(externo.estadoRemoto, { code: e.codigo, fullCode: e.codigoCompleto, createdAt: e.ocorridoEm }, externo.ultimoEventoEm);
      const metadata = objeto(decifrarIfood(e.metadataCifrada));
      if (e.codigo === "HSD") {
        const disputaId = uuid(metadata.id ?? metadata.disputeId), disputaAte = instante(metadata.expiresAt);
        const negociacoes = await tx.eventoIfood.findMany({ where: { lojaId: e.lojaId, pedidoExternoId: e.pedidoExternoId, estado: "PROCESSADO", codigo: { in: ["HSD", "HSS"] } }, select: { codigo: true, ocorridoEm: true, metadataCifrada: true } });
        const atrasada = negociacoes.some(n => n.ocorridoEm > e.ocorridoEm || n.codigo === "HSS" && objeto(decifrarIfood(n.metadataCifrada)).disputeId === disputaId);
        if (!atrasada) await tx.pedidoIfood.update({ where: { id: externo.id }, data: { disputaId, disputaAte, disputaCifrada: cifrarIfood({ ...metadata, snapshotHash: hashIfood(decifrarIfood(externo.snapshotCifrado)) }) } });
      }
      if (e.codigo === "HSS" && metadata.disputeId === externo.disputaId && ["ACCEPTED", "REJECTED", "EXPIRED", "ALTERNATIVE_REPLIED"].includes(String(metadata.status))) {
        const disputa = externo.disputaCifrada ? objeto(decifrarIfood(externo.disputaCifrada)) : null;
        const parcial = metadata.status === "ACCEPTED" && disputa?.action === "PARTIAL_CANCELLATION";
        const alternativa = metadata.selectedDisputeAlternative ? objeto(metadata.selectedDisputeAlternative) : null;
        const ajuste = metadata.status === "ALTERNATIVE_REPLIED" && ["REFUND", "BENEFIT"].includes(String(alternativa?.type));
        const aguardarItens = parcial && disputa?.snapshotHash === hashIfood(decifrarIfood(externo.snapshotCifrado));
        await tx.eventoIfood.update({ where: { id: e.id }, data: { metadataCifrada: cifrarIfood({ ...metadata, disputaAnterior: disputa }) } });
        await tx.pedidoIfood.update({ where: { id: externo.id }, data: { disputaId: null, disputaAte: null, disputaCifrada: null,
          ...(aguardarItens || ajuste ? { revisaoPendente: true, financeiroPendente: true, pendencia: pedidoEmAcompanhamento({ ...externo, loja: e.loja }) ? (aguardarItens ? "Cancelamento parcial no sistema principal. Aguardando ORDER_PATCHED para atualizar os itens; confira a operação no Takeat." : "Alternativa confirmada pelo iFood. Confira no Takeat; nenhum efeito financeiro é permitido neste acompanhamento.") : aguardarItens ? "Cancelamento parcial aceito. Aguardando ORDER_PATCHED para atualizar os itens e conferir o financeiro." : "Alternativa financeira confirmada pelo iFood. Confira o ajuste na carteira; nenhuma devolução, crédito local ou baixa automática foi criada." } : {}),
        } });
      }
      if (e.codigo === "OPA") {
        const recebido = (await requisicaoAutorizada(e.loja.integracaoId, `/order/v1.0/orders/${uuid(e.pedidoExternoId)}`, { lojaId: e.lojaId })).dados;
        const novo = adaptarPedido(recebido, e.loja.merchantId, e.loja.ambiente, fuso);
        if (novo.externoId !== e.pedidoExternoId) throw new ErroIfood("Identidade do pedido divergente na atualização.");
        const anterior = adaptarPedido(decifrarIfood(externo.snapshotCifrado), e.loja.merchantId, e.loja.ambiente, fuso);
        const vinculos = await tx.identidadeExternaVenda.findMany({ where: { origem: "IFOOD", loja: `${e.loja.ambiente}:${e.loja.merchantId}`, entidade: "PRODUTO", chave: { in: novo.itens.map(i => i.externoId) } } });
        const produtos = await tx.produtoVenda.findMany({ where: { id: { in: vinculos.map(v => v.destinoId) } }, select: { id: true } });
        const mudou = hashIfood({ total: anterior.dados.total, metodos: anterior.metodos, valores: anterior.valores, entregaPor: anterior.entregaPor }) !== hashIfood({ total: novo.dados.total, metodos: novo.metodos, valores: novo.valores, entregaPor: novo.entregaPor });
        const mesmaComposicao = hashIfood(anterior.snapshot) === hashIfood(novo.snapshot);
        // OPA sem mudança nos detalhes não comprova que o cancelamento parcial foi aplicado.
        // Alternativa financeira exige conferência no sistema responsável, mesmo se vier outro OPA.
        const alternativaPendente = externo.pendencia?.startsWith("Alternativa financeira confirmada") || externo.pendencia?.startsWith("Alternativa confirmada pelo iFood. Confira no Takeat");
        const parcialPendente = externo.pendencia?.startsWith("Cancelamento parcial aceito") || externo.pendencia?.startsWith("Cancelamento parcial no sistema principal");
        const manterRevisao = externo.revisaoPendente && (alternativaPendente || mesmaComposicao && parcialPendente);
        const temTitulos = await tx.lancamentoFinanceiro.count({ where: { pedidoVendaId: pedido.id } }) > 0;
        if (hashIfood(anterior.snapshot) !== hashIfood(novo.snapshot)) {
        await tx.itemPedidoVenda.updateMany({ where: { pedidoId: pedido.id, vigente: true }, data: { vigente: false } });
        await tx.pedidoVenda.update({ where: { id: pedido.id }, data: {
          ...novo.dados, enderecoSnapshot: novo.dados.enderecoSnapshot ?? Prisma.DbNull,
          ...(novo.clienteExternoId !== anterior.clienteExternoId ? { clienteId: null } : {}),
          itens: { create: novo.itens.map(({ externoId, externalCode, ...i }) => {
            void externalCode;
            const destino = vinculos.find(v => v.chave === externoId)?.destinoId;
            return { ...i, escolhasSnapshot: json(i.escolhasSnapshot), versaoPedido: pedido.versao + 1, produtoId: produtos.find(v => v.id === destino)?.id ?? null };
          }) },
        } });
        }
        await tx.eventoIfood.update({ where: { id: e.id }, data: { metadataCifrada: cifrarIfood({ ...metadata, snapshotAnterior: anterior.snapshot, snapshotAtual: novo.snapshot }) } });
        await tx.pedidoIfood.update({ where: { id: externo.id }, data: { snapshotCifrado: cifrarIfood(novo.snapshot), modalidade: novo.modalidade, entregaPor: novo.entregaPor, inicioPreparo: novo.inicioPreparo,
          revisaoPendente: novo.horarios.problemas.length > 0 || !!manterRevisao,
          financeiroPendente: externo.financeiroPendente || mudou,
          pendencia: mudou && temTitulos ? "Pedido atualizado no iFood. Confira os títulos na carteira: baixas e repasses anteriores foram preservados; ajuste financeiro pendente." : novo.pendencias.join("; ") || externo.pendencia,
        } });
      }
      if (["HSD", "HSS", "OPA"].includes(e.codigo)) await tx.pedidoVenda.update({ where: { id: pedido.id }, data: { versao: { increment: 1 } } });
      if (e.codigo === "CARF") await tx.acaoIfood.updateMany({ where: { pedidoIfoodId: externo.id, acao: "requestCancellation", estado: { in: ["ENVIANDO", "AGUARDANDO_EVENTO", "INCERTA"] }, enviadaEm: { lte: e.ocorridoEm } }, data: { estado: "RECUSADA", erro: "Cancelamento recusado pelo iFood; pedido preservado" } });
      if (proximo) {
        const confirmado = !["PLACED", "CANCELLED"].includes(proximo);
        await tx.pedidoVenda.update({ where: { id: pedido.id }, data: { status: proximo === "CANCELLED" ? "CANCELADO" : confirmado ? "CONFIRMADO" : pedido.status,
          statusOperacional: estadoInterno(proximo), confirmadoEm: confirmado ? pedido.confirmadoEm ?? e.ocorridoEm : pedido.confirmadoEm,
          entregueEm: proximo === "CONCLUDED" ? pedido.entregueEm ?? e.ocorridoEm : pedido.entregueEm,
          canceladoEm: proximo === "CANCELLED" ? e.ocorridoEm : pedido.canceladoEm, versao: { increment: 1 } } });
        await tx.pedidoIfood.update({ where: { id: externo.id }, data: { estadoRemoto: proximo, ultimoEventoEm: e.ocorridoEm } });
        if ((confirmado || proximo === "CANCELLED") && !externo.revisaoPendente && !pedidoEmAcompanhamento({ ...externo, loja: e.loja })) {
          const p = adaptarPedido(decifrarIfood(externo.snapshotCifrado), e.loja.merchantId, e.loja.ambiente, fuso);
          const pendencia = await projetarFinanceiro(tx, pedido.id, p, proximo === "CANCELLED");
          await tx.pedidoIfood.update({ where: { id: externo.id }, data: { financeiroPendente: !!pendencia, ...(pendencia ? { pendencia } : {}) } });
        }
      }
      if (pedidoEmAcompanhamento({ ...externo, loja: e.loja })) await tx.pedidoIfood.update({ where: { id: externo.id }, data: { financeiroPendente: false } });
      const acoes = await tx.acaoIfood.findMany({ where: { pedidoIfoodId: externo.id, estado: { in: ["ENVIANDO", "AGUARDANDO_EVENTO", "INCERTA"] } } });
      for (const a of acoes) {
        const resultado = confirmacaoAcaoIfood(a.acao, a.corpoCifrado ? decifrarIfood(a.corpoCifrado) : null, a.enviadaEm, { codigoCompleto: e.codigoCompleto, ocorridoEm: e.ocorridoEm, metadata });
        if (resultado) await tx.acaoIfood.update({ where: { id: a.id }, data: { estado: resultado, erro: null } });
      }
      await tx.historicoPedidoVenda.create({ data: { pedidoId: pedido.id, tipo: "IFOOD_EVENTO", chaveOperacao: `ifood-evento:${e.id}`, hashOperacao: hashIfood([e.codigo, e.externoId]), usuarioId: e.loja.integracao.criadoPorId, usuarioNome: "Integração iFood", versaoAnterior: pedido.versao, versaoNova: pedido.versao + (proximo || ["HSD", "HSS", "OPA"].includes(e.codigo) ? 1 : 0), depois: { evento: e.codigoCompleto, aplicado: !!proximo, estado: proximo ?? externo.estadoRemoto, integracaoId: e.loja.integracaoId } } });
      await tx.eventoIfood.update({ where: { id: e.id }, data: { estado: "PROCESSADO", erro: null } }); return true;
    }, { timeout: 45000, maxWait: 10000 });
  } catch (erro) {
    if (!eventoId) throw erro;
    const e = await prisma.eventoIfood.findUniqueOrThrow({ where: { id: eventoId } });
    const permanente = erro instanceof ErroIfood && (!(erro instanceof FalhaHttpIfood) || erro.status >= 400 && erro.status < 500 && erro.status !== 429);
    await prisma.eventoIfood.updateMany({ where: { id: e.id, estado: "PENDENTE", tentativas: e.tentativas }, data: { tentativas: { increment: 1 }, estado: permanente || e.tentativas >= 5 ? "FALHOU" : "PENDENTE", proximaTentativa: new Date(Date.now() + (erro instanceof FalhaHttpIfood && erro.status === 429 ? erro.esperaMs : Math.min(300000, 30000 * 2 ** e.tentativas))), erro: erro instanceof ErroIfood ? erro.message : "Falha local ao processar; evento preservado" } });
    if (erro instanceof FalhaHttpIfood && [401, 403].includes(erro.status)) await prisma.lojaIfood.update({ where: { id: e.lojaId }, data: { autorizada: false, ultimoErro: erro.message } });
    return true;
  }
}
