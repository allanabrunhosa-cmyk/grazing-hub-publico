import "server-only";
import { prisma } from "@/lib/prisma";
import { acessoIfood, exigirConta } from "./acesso";
import { decifrarIfood } from "./tokens";
import { ErroIfood, uuid } from "./dominio";
import { confirmacaoAcaoIfood } from "./confirmacao-acao";
import { hashIfood } from "./processamento";
import type { SessaoAtual } from "@/lib/session";

export async function recuperarAcoesIfood() {
  if (process.env.IFOOD_ATIVO !== "1") return;
  const acoes = await prisma.acaoIfood.findMany({ where: { estado: { in: ["INCERTA", "AGUARDANDO_EVENTO"] } }, orderBy: { createdAt: "asc" }, take: 20, include: { pedidoIfood: { include: { loja: { include: { integracao: true } } } } } });
  for (const a of acoes) {
    exigirConta(a.pedidoIfood.loja.integracao.contaId);
    if (!a.enviadaEm) continue;
    const eventos = await prisma.eventoIfood.findMany({ where: { lojaId: a.pedidoIfood.lojaId, pedidoExternoId: a.pedidoIfood.externoId, estado: "PROCESSADO", ocorridoEm: { gte: a.enviadaEm } }, orderBy: { ocorridoEm: "asc" } });
    for (const e of eventos) {
      const resultado = confirmacaoAcaoIfood(a.acao, a.corpoCifrado ? decifrarIfood(a.corpoCifrado) : null, a.enviadaEm, { ...e, metadata: decifrarIfood(e.metadataCifrada) });
      if (!resultado) continue;
      await prisma.$transaction(async tx => {
        const mudou = await tx.acaoIfood.updateMany({ where: { id: a.id, estado: { in: ["INCERTA", "AGUARDANDO_EVENTO"] } }, data: { estado: resultado, erro: null } });
        if (mudou.count) await tx.historicoPedidoVenda.create({ data: { pedidoId: a.pedidoIfood.pedidoId, tipo: "IFOOD_RECONCILIACAO", chaveOperacao: "ifood-reconciliacao:" + a.id, hashOperacao: hashIfood([a.id, e.id]), usuarioId: a.autorId, usuarioNome: "Integração iFood", versaoAnterior: a.revisao, versaoNova: a.revisao, depois: { acaoId: a.id, eventoId: e.id, resultado } } });
      });
      break;
    }
  }
}

export async function registrarConferenciaIfood(pedidoId: string, acaoId: string, situacao: string, referencia: string, chave: string, sessao: SessaoAtual) {
  uuid(chave);
  if (!["SEM_EVIDENCIA", "SUPORTE_ACIONADO", "DIVERGENCIA"].includes(situacao) || !/^[A-Za-z0-9/_#.-]{1,80}$/.test(referencia)) throw new ErroIfood("Escolha a situação e informe apenas a referência do atendimento, sem dados privados.");
  return prisma.$transaction(async tx => {
    const autor = await acessoIfood(tx, sessao, "vendas.pedidos.revisar");
    const a = await tx.acaoIfood.findUniqueOrThrow({ where: { id: acaoId }, include: { pedidoIfood: { include: { pedido: true, loja: { include: { integracao: true } } } } } });
    exigirConta(a.pedidoIfood.loja.integracao.contaId);
    if (a.pedidoIfood.pedidoId !== pedidoId || !["INCERTA", "AGUARDANDO_EVENTO"].includes(a.estado)) throw new ErroIfood("Ação indisponível para conferência.");
    const hash = hashIfood({ pedidoId, acaoId, situacao, referencia }), operacao = "ifood-conferencia:" + chave;
    const anterior = await tx.historicoPedidoVenda.findUnique({ where: { chaveOperacao: operacao } });
    if (anterior) { if (anterior.hashOperacao !== hash) throw new ErroIfood("Chave utilizada com outro conteúdo."); return; }
    await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo: "IFOOD_CONFERENCIA", chaveOperacao: operacao, hashOperacao: hash, usuarioId: autor.id, usuarioNome: autor.nome, versaoAnterior: a.pedidoIfood.pedido.versao, versaoNova: a.pedidoIfood.pedido.versao, depois: { acaoId, situacao, referencia, confirmado: false, reenviado: false } } });
    await tx.acaoIfood.update({ where: { id: acaoId }, data: { erro: "Conferência registrada: " + situacao + ". Resultado permanece pendente de evidência oficial." } });
  });
}
