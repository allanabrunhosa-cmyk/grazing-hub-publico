"use server";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/session-token";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { configurarIntegracao, renovarAutorizacao, retomarEventos, listarMerchants, vincularLoja, ativarLoja, consultarEstadoLoja, prepararAcompanhamento } from "@/lib/ifood/configuracao";
import { iniciarVinculo, concluirVinculo, decifrarIfood } from "@/lib/ifood/tokens";
import type { EntradaAcaoIfood } from "@/lib/ifood/negociacao";
import { consultarDetalhesMerchant, consultarOperacaoMerchant, solicitarMerchant } from "@/lib/ifood/merchant";
import { registrarConferenciaIfood } from "@/lib/ifood/reconciliacao";
import { motivosCancelamento, solicitarAcao } from "@/lib/ifood/acoes";
import { ErroIfood, type AcaoIfoodNome } from "@/lib/ifood/dominio";
import { acessoIfood, exigirConta } from "@/lib/ifood/acesso";
import { adaptarPedido } from "@/lib/ifood/adaptador";
import { gerarTitulosIfood } from "@/lib/ifood/financeiro";
import { prisma } from "@/lib/prisma";
import { diaValido } from "@/lib/vendas/pedidos-agenda-dominio";

async function marcaSessao() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new ErroIfood("Sessão encerrada.");
  return createHash("sha256").update(token).digest("hex");
}
const falha = (e: unknown) => ({ erro: e instanceof ErroIfood ? e.message : "Não foi possível concluir. Confira as pendências e tente novamente." });
export async function configurarIfoodAction(ambiente: string, modalidade: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { const r = await configurarIntegracao({ ambiente, modalidade }, s); revalidatePath("/vendas/pedidos/ifood"); return { ok: true as const, ...r }; } catch(e) { return falha(e); }
}
export async function iniciarVinculoIfoodAction(id: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { return { ok: true as const, ...await iniciarVinculo(id, s, await marcaSessao()) }; } catch(e) { return falha(e); }
}
export async function concluirVinculoIfoodAction(id: string, solicitacao: string, codigo: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { await concluirVinculo(id, solicitacao, codigo, s, await marcaSessao()); revalidatePath("/vendas/pedidos/ifood"); return { ok: true as const }; } catch(e) { return falha(e); }
}
export async function listarLojasIfoodAction(id: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { return { ok: true as const, lojas: await listarMerchants(id, s) }; } catch(e) { return falha(e); }
}
export async function vincularLojaIfoodAction(id: string, merchant: string, canal: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { await vincularLoja(id, merchant, canal, s); revalidatePath("/vendas/pedidos/ifood"); return { ok: true as const }; } catch(e) { return falha(e); }
}
export async function prepararAcompanhamentoIfoodAction(id: string, entrada: Parameters<typeof prepararAcompanhamento>[1]) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { await prepararAcompanhamento(id, entrada, s); revalidatePath("/vendas/pedidos/ifood"); return { ok: true as const }; } catch(e) { return falha(e); }
}
export async function ativarLojaIfoodAction(id: string, ativa: boolean) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { await ativarLoja(id, ativa, s); revalidatePath("/vendas/pedidos/ifood"); return { ok: true as const }; } catch(e) { return falha(e); }
}
export async function estadoLojaIfoodAction(id: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { return { ok: true as const, estado: await consultarEstadoLoja(id, s) }; } catch(e) { return falha(e); }
}
export async function motivosIfoodAction(id: string) {
  const s = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  try { return { ok: true as const, motivos: await motivosCancelamento(id, s) }; } catch(e) { return falha(e); }
}
export async function acaoPedidoIfoodAction(id: string, versao: number, acao: AcaoIfoodNome, entrada: EntradaAcaoIfood, chave: string) {
  const s = await exigirPermissao("vendas.pedidos");
  try { await solicitarAcao(id, versao, acao, entrada, chave, s); revalidatePath("/vendas/pedidos", "layout"); return { ok: true as const }; } catch(e) { return falha(e); }
}
export async function gerarFinanceiroIfoodAction(id: string, versao: number, vencimento: string, formas: Record<string, string>) {
  const s = await exigirPermissao("financeiro.movimentacoes", "editar");
  try {
    if (!diaValido(vencimento)) throw new ErroIfood("Informe um vencimento válido.");
    await prisma.$transaction(async tx => {
      const autor = await acessoIfood(tx, s, "financeiro.movimentacoes");
      const p = await tx.pedidoIfood.findUniqueOrThrow({ where: { pedidoId: id }, include: { loja: { include: { integracao: true } }, pedido: true } }); exigirConta(p.loja.integracao.contaId);
      await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${id} FOR UPDATE`;
      const atual = await tx.pedidoVenda.findUniqueOrThrow({ where: { id } });
      if (atual.versao !== versao) throw new ErroIfood("Pedido alterado; atualize antes de continuar.");
      if (p.revisaoPendente) throw new ErroIfood("Pedido alterado no iFood; conferência remota pendente.");
      const remoto = adaptarPedido(decifrarIfood(p.snapshotCifrado), p.loja.merchantId, p.loja.ambiente, p.pedido.fusoHorario);
      await gerarTitulosIfood(tx, id, remoto, new Date(vencimento + "T12:00:00Z"), autor, formas);
      await tx.pedidoIfood.update({ where: { id: p.id }, data: { financeiroPendente: false, pendencia: null } });
    });
    revalidatePath("/vendas/pedidos", "layout"); return { ok: true as const };
  } catch(e) { return falha(e); }
}

export async function renovarAutorizacaoIfoodAction(id: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { const lojas = await renovarAutorizacao(id,s); revalidatePath("/vendas/pedidos/ifood"); return {ok:true as const,lojas}; } catch(e) { return falha(e); }
}
export async function retomarEventosIfoodAction(id: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { const quantidade = await retomarEventos(id,s); revalidatePath("/vendas/pedidos/ifood"); return {ok:true as const,quantidade}; } catch(e) { return falha(e); }
}

export async function conferirAcaoIfoodAction(id: string, acaoId: string, situacao: string, referencia: string, chave: string) {
  const s = await exigirPermissao("vendas.pedidos.revisar", "editar");
  try { await registrarConferenciaIfood(id, acaoId, situacao, referencia, chave, s); revalidatePath("/vendas/pedidos", "layout"); return { ok: true as const }; } catch(e) { return falha(e); }
}

export async function consultarMerchantIfoodAction(lojaId: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { return { ok: true as const, dados: await consultarOperacaoMerchant(lojaId, s) }; } catch(e) { return falha(e); }
}
export async function detalhesMerchantIfoodAction(lojaId: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { return { ok: true as const, dados: await consultarDetalhesMerchant(lojaId, s) }; } catch(e) { return falha(e); }
}
export async function solicitarMerchantIfoodAction(lojaId: string, acao: string, entrada: unknown, chave: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  try { await solicitarMerchant(lojaId, acao, entrada, chave, s); return { ok: true as const }; } catch(e) { return falha(e); }
}

export async function salvarFinanceiroConfigIfoodAction(lojaId: string, versao: number, entrada: unknown, chave: string) {
  const s = await exigirPermissao("configuracoes.loja", "editar");
  await exigirPermissao("financeiro.movimentacoes", "editar");
  try { const { salvarFinanceiroConfigIfood } = await import("@/lib/ifood/configuracao"); await salvarFinanceiroConfigIfood(lojaId, versao, entrada, chave, s); revalidatePath("/vendas/pedidos/ifood"); return { ok: true as const }; } catch (e) { return falha(e); }
}
