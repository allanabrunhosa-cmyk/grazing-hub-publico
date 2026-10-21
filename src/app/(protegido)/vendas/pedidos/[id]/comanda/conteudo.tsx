import { pedidoEmAcompanhamento, ROTULO_ACOMPANHAMENTO_IFOOD } from "@/lib/ifood/acompanhamento-dominio";
import { horariosSnapshotIfood } from "@/lib/ifood/horarios-servidor";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { resumirRevisaoProducao } from "@/lib/vendas/pedidos-revisao-resumo";
import { ComandaPedido } from "./comanda-client";
import type { ResumoOperacional } from "../operacao/operacao-client";
import { ModalPedido } from "../../modal-pedido";
import { MensagemPopupPedido } from "../../mensagem-popup";
import { ehPedidoHistorico } from "@/lib/vendas/historico-dominio";
export async function ConteudoComanda({ params, retorno }: { params: Promise<{ id: string }>; retorno?: string }) {
  if (!await podeAcessar("vendas.pedidos") && !await podeAcessar("vendas.pedidos.producao")) return <MensagemPopupPedido titulo="Acesso à comanda" mensagem="Seu perfil não possui permissão para consultar a comanda." retorno={retorno} />;
  if (!await podeAcessar("vendas.pedidos")) await exigirPermissao("vendas.pedidos.producao"); else await exigirPermissao("vendas.pedidos");
  const { id } = await params;
  const p = await prisma.pedidoVenda.findUnique({ where: { id }, select: { origem: true, referenciaOrigem: true, ifood: { select: { snapshotCifrado: true, acompanhamento: true, loja: { select: { modoOperacao: true } } } }, id: true, numero: true, versao: true, status: true, statusOperacional: true, atendimento: true, fusoHorario: true, referenciaPedido: true, previsaoData: true, previsaoJanela: true, observacoes: true, itens: { where: { vigente: true }, orderBy: { ordem: "asc" }, select: { id: true, quantidade: true, unidadeSnapshot: true, observacoes: true, produtoSnapshot: true, escolhasSnapshot: true } }, historico: { where: { tipo: "REVISADO" }, orderBy: { createdAt: "asc" }, select: { versaoNova: true, antes: true, depois: true } } } });
  if (p && pedidoEmAcompanhamento(p.ifood)) return <MensagemPopupPedido titulo={ROTULO_ACOMPANHAMENTO_IFOOD} mensagem="A comanda operacional permanece no Takeat durante o acompanhamento." retorno={retorno} />;
  if (p && (p.status === "HISTORICO" || p.status === "HISTORICO_REVERTIDO" || ehPedidoHistorico(p))) return <MensagemPopupPedido titulo="Pedido histórico" mensagem="Este pedido preserva a venda do sistema anterior. Ele não gera comanda de produção." retorno={retorno} />;
  if (!p || ["RASCUNHO", "RECEBIDO_EXTERNO"].includes(p.status)) return <MensagemPopupPedido titulo="Comanda indisponível" mensagem="A comanda fica disponível após a confirmação do pedido. Feche a janela para retornar ao Gestor." retorno={retorno} />;
  const horarios = horariosSnapshotIfood(p.ifood?.snapshotCifrado, p.fusoHorario);
  // Lista explícita: snapshots comerciais inteiros não atravessam a fronteira do cliente.
  const pedido: ResumoOperacional = { id: p.id, numero: p.numero, versao: p.versao, status: p.status, statusOperacional: p.statusOperacional, atendimento: p.atendimento, fusoHorario: p.fusoHorario, referenciaPedido: p.referenciaPedido, previsaoData: p.previsaoData?.toISOString() ?? null, previsaoJanela: horarios?.janela ?? p.previsaoJanela, inicioPreparoIfood: horarios?.inicioPreparo?.toISOString() ?? null, observacoes: p.observacoes, destinatarioSnapshot: null, enderecoSnapshot: null, historico: [], revisoesProducao: p.historico.map(h => ({ versao: h.versaoNova, descricao: resumirRevisaoProducao(h.antes, h.depois) })), itens: p.itens.map(i => ({ id: i.id, quantidade: i.quantidade.toString(), observacoes: i.observacoes, unidadeSnapshot: i.unidadeSnapshot, produtoSnapshot: { nome: (i.produtoSnapshot as { nome: string }).nome }, escolhasSnapshot: (i.escolhasSnapshot as { opcaoNome: string; quantidade: number }[]).map(e => ({ opcaoNome: e.opcaoNome, quantidade: e.quantidade })) })) };
  return <ModalPedido titulo={`Comanda de produção #${p.numero}`} descricao={`Revise a versão ${p.versao} antes de preparar. Impressão pelo navegador, sem confirmação física automática.`} retorno={retorno}><ComandaPedido pedido={pedido} geradoEm={new Date().toISOString()} /></ModalPedido>;
}
