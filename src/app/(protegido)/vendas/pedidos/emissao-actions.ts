"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { ErroEstruturaFiscal } from "@/lib/tributacao/validacao";
import { ErroConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dominio";
import { ErroTransmissaoFiscalBloqueadaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao";
import { prepararEmissaoPedidoBrasilNfe, emitirNotaPedidoBrasilNfe, consultarEmissaoPedidoBrasilNfe, obterDocumentosEmissaoPedidoBrasilNfe, ErroEmissaoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";
import { cancelarNotaPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cancelamento";
import { consultarResultadoEmissaoPedidoBrasilNfe, emitirNotaPedidoDiretaBrasilNfe, obterResultadoLocalEmissaoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/emissao-direta";
import type { SessaoAtual } from "@/lib/session";
import { ErroValidacaoSnapshotBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe";
import { ErroHttpBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { ErroConsultaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/consulta";

function erroSeguro(e: unknown) {
  return e instanceof ErroPedidoVenda || e instanceof ErroEmissaoPedidoBrasilNfe || e instanceof ErroEstruturaFiscal || e instanceof ErroConfiguracaoBrasilNfe || e instanceof ErroTransmissaoFiscalBloqueadaBrasilNfe || e instanceof ErroValidacaoSnapshotBrasilNfe || e instanceof ErroHttpBrasilNfe || e instanceof ErroConsultaBrasilNfe ? e.message : "A ação não foi confirmada. Consulte o documento antes de qualquer novo envio.";
}
function atualizarPedido() {
  revalidatePath("/vendas/pedidos", "layout");
  revalidatePath("/financeiro/fiscal");
}
export type ContextoPreparacaoFiscalPedido = {
  indicadorPresenca?: 1 | 2 | 3 | 4 | 5 | 9;
  pagamentoCartaoNaoIntegrado?: true;
};
/** Preparação local. Não consulta o fornecedor nem transmite a nota. */
export async function prepararEmissaoPedidoBrasilNfeAction(pedidoId: string, versao: number, modelo: 55 | 65, ambiente: "HOMOLOGACAO" | "PRODUCAO", contexto?: ContextoPreparacaoFiscalPedido) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    const previa = contexto === undefined ? await prepararEmissaoPedidoBrasilNfe(pedidoId, versao, modelo, ambiente, sessao) : await prepararEmissaoPedidoBrasilNfe(pedidoId, versao, modelo, ambiente, sessao, contexto);
    atualizarPedido();
    return { ok: true as const, previa };
  } catch (e) { return { erro: erroSeguro(e) }; }
}
export async function emitirNotaPedidoBrasilNfeAction(entrada: unknown) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    const documento = await emitirNotaPedidoBrasilNfe(entrada, sessao);
    atualizarPedido();
    return { ok: true as const, documento };
  } catch (e) { atualizarPedido(); return { erro: erroSeguro(e) }; }
}
async function recuperarResultadoLocal(pedidoId: unknown, sessao: SessaoAtual) {
  if (typeof pedidoId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(pedidoId)) return null;
  try { return await obterResultadoLocalEmissaoPedidoBrasilNfe(pedidoId, sessao); } catch { return null; }
}
/** O próprio botão do pedido prepara e transmite uma vez, sem diálogo intermediário. */
export async function emitirNotaPedidoDiretaBrasilNfeAction(entrada: unknown) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    const resultado = await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao);
    atualizarPedido();
    return resultado;
  } catch (e) {
    const pedidoId = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? (entrada as Record<string, unknown>).pedidoId : null;
    const local = await recuperarResultadoLocal(pedidoId, sessao);
    atualizarPedido();
    // Uma falha sem resposta pode ocorrer depois do POST. Não liberar novo envio.
    return { erro: erroSeguro(e), documento: local?.documento ?? null, conferirAntesDeRepetir: local?.conferirAntesDeRepetir ?? true };
  }
}
/** Recupera a tentativa do pedido, mesmo quando o navegador perdeu o documentoId. */
export async function consultarResultadoEmissaoPedidoBrasilNfeAction(pedidoId: string) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    const resultado = await consultarResultadoEmissaoPedidoBrasilNfe(pedidoId, sessao);
    atualizarPedido();
    return resultado;
  } catch (e) {
    const local = await recuperarResultadoLocal(pedidoId, sessao);
    atualizarPedido();
    return { erro: erroSeguro(e), documento: local?.documento ?? null, conferirAntesDeRepetir: true as const };
  }
}
export async function consultarEmissaoPedidoBrasilNfeAction(documentoId: string) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { const documento = await consultarEmissaoPedidoBrasilNfe(documentoId, sessao); atualizarPedido(); return { ok: true as const, documento }; }
  catch (e) { atualizarPedido(); return { erro: erroSeguro(e) }; }
}
export async function obterDocumentosEmissaoPedidoBrasilNfeAction(documentoId: string) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { const documento = await obterDocumentosEmissaoPedidoBrasilNfe(documentoId, sessao); atualizarPedido(); return { ok: true as const, documento }; }
  catch (e) { atualizarPedido(); return { erro: erroSeguro(e) }; }
}
export async function cancelarNotaPedidoBrasilNfeAction(entrada: unknown) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { const documento = await cancelarNotaPedidoBrasilNfe(entrada, sessao); atualizarPedido(); return { ok: true as const, documento }; }
  catch (e) { atualizarPedido(); return { erro: erroSeguro(e) }; }
}
