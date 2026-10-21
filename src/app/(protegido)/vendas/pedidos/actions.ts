"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { creditoAbertoCliente, encerrarPedidoManual, ajustarVencimentoPedido, cancelarPedido, concederCreditoPedido, concluirDevolucaoPedido, confirmarPedido, confirmarPagamentoBoletoPedido, criarRascunhoPedido, liberarCreditoAplicadoPedido, mudarEstadoDevolucaoPedido, registrarCapturaCartaoPedido, registrarEmissaoBoletoPedido, registrarEntregaPedido, registrarRecebimentoPedido, registrarRepasseCartaoPedido, revisarPedido, salvarRascunhoPedido, solicitarDevolucaoPedido, type CondicaoFinanceiraPedido } from "@/lib/vendas/pedidos";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { ErroCadastroVenda } from "@/lib/vendas/dominio";
import { executarOperacaoInterfacePedido } from "@/lib/vendas/pedidos";
import type { ComandoOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import { corrigirRecebimentoPedido, registrarCancelamentoBoletoPedido, registrarEntradaTardiaBoletoPedido } from "@/lib/vendas/pedidos";
import { editarInformacoesPedido } from "@/lib/vendas/pedidos";
import { validarMotivoCancelamento, validarResponsavelCancelamento } from "@/lib/vendas/cancelamento-pedido-dominio";

export async function registrarCancelamentoBoletoPedidoAction(id: string, cobrancaId: string, evidencia: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.movimentacoes", "editar");
  try { await registrarCancelamentoBoletoPedido(id, cobrancaId, evidencia, chave, sessao); atualizar(id); return { ok: true as const }; } catch (erro) { return falha(erro); }
}
export async function registrarEntradaTardiaBoletoPedidoAction(id: string, cobrancaId: string, contaId: string, data: string, evidencia: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.baixas", "editar");
  try { await registrarEntradaTardiaBoletoPedido(id, cobrancaId, contaId, data, evidencia, chave, sessao); atualizar(id); return { ok: true as const }; } catch (erro) { return falha(erro); }
}

export async function corrigirRecebimentoPedidoAction(id: string, tituloId: string, revisao: string, motivo: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.estornos", "editar");
  await exigirPermissao("financeiro.movimentacoes", "editar");
  try { await corrigirRecebimentoPedido(id, tituloId, revisao, motivo, chave, sessao); atualizar(id); return { ok: true as const }; } catch (erro) { return falha(erro); }
}

export async function executarOperacaoPedidoAction(id: string, versao: number, comando: ComandoOperacao, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos");
  try { const salvo = await executarOperacaoInterfacePedido(id, versao, comando, chave, sessao); atualizar(id); revalidatePath(`/vendas/pedidos/${id}/operacao`); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}

function falha(erro: unknown) { return { erro: erro instanceof ErroPedidoVenda || erro instanceof ErroCadastroVenda ? erro.message : "Não foi possível concluir a operação. Seu preenchimento foi preservado." }; }
function atualizar(id: string) { revalidatePath("/vendas/pedidos/producao"); revalidatePath("/vendas/pedidos/calendario"); revalidatePath("/vendas/pedidos"); revalidatePath(`/vendas/pedidos/${id}`); revalidatePath("/financeiro"); revalidatePath("/financeiro/fluxo-de-caixa"); revalidatePath("/financeiro/movimentacoes"); }

export async function criarRascunhoPedidoAction(entrada: unknown, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos", "adicionar");
  try { const salvo = await criarRascunhoPedido(entrada, chave, sessao, "HUB", 1); atualizar(salvo.id); if (salvo.clienteId) revalidatePath("/vendas/clientes"); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}
export async function salvarRascunhoPedidoAction(id: string, versao: number, entrada: unknown, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos", "adicionar");
  try { const salvo = await salvarRascunhoPedido(id, versao, entrada, chave, sessao); atualizar(salvo.id); if (salvo.clienteId) revalidatePath("/vendas/clientes"); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}
/** Crédito em aberto do cliente para o editor; mesma permissão de confirmar pedidos. */
export async function consultarCreditoClientePedidoAction(clienteId: string) {
  await exigirPermissao("vendas.pedidos.confirmar", "editar");
  try { return { ok: true as const, ...await creditoAbertoCliente(clienteId) }; } catch (erro) { return falha(erro); }
}
export async function confirmarPedidoVendaAction(id: string, versao: number, chave: string, condicao?: CondicaoFinanceiraPedido) {
  const sessao = await exigirPermissao("vendas.pedidos.confirmar", "editar");
  try { const salvo = await confirmarPedido(id, versao, chave, sessao, condicao); atualizar(salvo.id); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}
export async function revisarPedidoVendaAction(id: string, versao: number, entrada: unknown, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.revisar", "editar");
  try { const salvo = await revisarPedido(id, versao, entrada, chave, sessao); atualizar(salvo.id); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}
export async function editarInformacoesPedidoAction(id: string, versao: number, entrada: unknown, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.revisar", "editar");
  await exigirPermissao("vendas.pedidos", "visualizar");
  try { const salvo = await editarInformacoesPedido(id, versao, entrada, chave, sessao); atualizar(salvo.id); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}
export async function cancelarPedidoVendaAction(id: string, versao: number, motivo: string, chave: string, tratamento?: import("@/lib/vendas/pedidos").TratamentoCancelamento, responsavelInformado?: string) {
  const sessao = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  try { const nome = validarResponsavelCancelamento(responsavelInformado); const motivoValidado = validarMotivoCancelamento(motivo); const salvo = await cancelarPedido(id, versao, motivoValidado, chave, sessao, tratamento, nome); atualizar(salvo.id); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}
export async function registrarEntregaPedidoVendaAction(id: string, versao: number, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.revisar", "editar");
  try { const salvo = await registrarEntregaPedido(id, versao, chave, sessao); atualizar(salvo.id); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}
export async function registrarRecebimentoPedidoAction(id: string, tituloId: string, valor: string, contaId: string, data: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.baixas", "editar");
  try { const financeiro = await registrarRecebimentoPedido(id, tituloId, valor, contaId, data, chave, sessao); atualizar(id); return { ok: true as const, financeiro }; } catch (erro) { return falha(erro); }
}
export async function ajustarVencimentoPedidoAction(id: string, tituloId: string, vencimento: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.revisar", "editar");
  await exigirPermissao("financeiro.movimentacoes", "editar");
  try { const financeiro = await ajustarVencimentoPedido(id, tituloId, vencimento, chave, sessao); atualizar(id); return { ok: true as const, financeiro }; } catch (erro) { return falha(erro); }
}
export async function registrarCapturaCartaoPedidoAction(id: string, tituloId: string, referencia: string, evidencia: string, data: string, taxa: string | null, previsao: string | null, chave: string) {
  const sessao = await exigirPermissao("financeiro.baixas", "editar");
  try { const financeiro = await registrarCapturaCartaoPedido(id, tituloId, referencia, evidencia, data, taxa, previsao, chave, sessao); atualizar(id); return { ok: true as const, financeiro }; } catch (erro) { return falha(erro); }
}
export async function registrarEmissaoBoletoPedidoAction(id: string, tituloId: string, referencia: string, documento: string | null, vencimento: string, evidencia: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.movimentacoes", "editar");
  try { const financeiro = await registrarEmissaoBoletoPedido(id, tituloId, referencia, documento, vencimento, evidencia, chave, sessao); atualizar(id); return { ok: true as const, financeiro }; } catch (erro) { return falha(erro); }
}
export async function confirmarPagamentoBoletoPedidoAction(id: string, cobrancaId: string, contaId: string, data: string, evidencia: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.baixas", "editar");
  try { const financeiro = await confirmarPagamentoBoletoPedido(id, cobrancaId, contaId, data, evidencia, chave, sessao); atualizar(id); return { ok: true as const, financeiro }; } catch (erro) { return falha(erro); }
}
export async function registrarRepasseCartaoPedidoAction(id: string, pagamentoId: string, bruto: string, taxa: string, contaId: string, data: string, categoriaTaxaId: string | null, competenciaTaxa: string | null, evidencia: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.baixas", "editar");
  await exigirPermissao("financeiro.movimentacoes", "editar");
  try { const financeiro = await registrarRepasseCartaoPedido(id, pagamentoId, bruto, taxa, contaId, data, categoriaTaxaId, competenciaTaxa, evidencia, chave, sessao); atualizar(id); return { ok: true as const, financeiro }; } catch (erro) { return falha(erro); }
}
export async function solicitarDevolucaoPedidoAction(id: string, devolver: string, reter: string, motivo: string, politica: string, comunicacao: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  await exigirPermissao("financeiro.baixas", "editar");
  try { const tratamento = await solicitarDevolucaoPedido(id, devolver, reter, motivo, politica, comunicacao, chave, sessao); atualizar(id); return { ok: true as const, tratamento: JSON.parse(JSON.stringify(tratamento)) as { id: string; status: string; tipo: string; valor: string; retido: string; motivo: string | null; referenciaPolitica: string | null; referenciaComunicacao: string | null; evidenciaConclusao: string | null; concluidoEm: string | null } }; } catch (erro) { return falha(erro); }
}
export async function mudarEstadoDevolucaoPedidoAction(id: string, tratamentoId: string, estado: "PROCESSANDO" | "FALHA" | "CANCELADA", motivo: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  await exigirPermissao("financeiro.baixas", "editar");
  try { const tratamento = await mudarEstadoDevolucaoPedido(id, tratamentoId, estado, motivo, chave, sessao); atualizar(id); return { ok: true as const, tratamento: JSON.parse(JSON.stringify(tratamento)) as { status: string } }; } catch (erro) { return falha(erro); }
}
export async function concluirDevolucaoPedidoAction(id: string, tratamentoId: string, contaId: string, data: string, categoriaId: string, competencia: string, evidencia: string, chave: string) {
  const sessao = await exigirPermissao("financeiro.baixas", "editar");
  await exigirPermissao("vendas.pedidos.cancelar", "editar");
  await exigirPermissao("financeiro.movimentacoes", "editar");
  try { const tratamento = await concluirDevolucaoPedido(id, tratamentoId, contaId, data, categoriaId, competencia, evidencia, chave, sessao); atualizar(id); return { ok: true as const, tratamento: JSON.parse(JSON.stringify(tratamento)) as { status: string; evidenciaConclusao: string | null; concluidoEm: string | null } }; } catch (erro) { return falha(erro); }
}
export async function concederCreditoPedidoAction(id: string, valor: string, escolhaData: string, comunicacao: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  await exigirPermissao("financeiro.baixas", "editar");
  await exigirPermissao("financeiro.movimentacoes", "editar");
  try { const tratamento = await concederCreditoPedido(id, valor, escolhaData, comunicacao, chave, sessao); atualizar(id); revalidatePath("/vendas/clientes"); return { ok: true as const, tratamento: JSON.parse(JSON.stringify(tratamento)) as { id: string; status: string; tipo: string; valor: string; retido: string; motivo: string | null; referenciaPolitica: string | null; referenciaComunicacao: string | null; evidenciaConclusao: string | null; concluidoEm: string | null } }; } catch (erro) { return falha(erro); }
}
export async function liberarCreditoAplicadoPedidoAction(id: string, valor: string, motivo: string, comunicacao: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  await exigirPermissao("financeiro.baixas", "editar");
  await exigirPermissao("financeiro.movimentacoes", "editar");
  try { const movimento = await liberarCreditoAplicadoPedido(id, valor, motivo, comunicacao, chave, sessao); atualizar(id); revalidatePath("/vendas/clientes"); return { ok: true as const, movimento: JSON.parse(JSON.stringify(movimento)) as { id: string; valor: string } }; } catch (erro) { return falha(erro); }
}

export async function encerrarPedidoManualAction(id: string, versao: number, estado: "DECLINADO" | "ESTORNADO", motivo: string, referencia: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  try { const salvo = await encerrarPedidoManual(id, versao, estado, motivo, referencia, chave, sessao); atualizar(id); return { ok: true as const, ...salvo }; } catch (erro) { return falha(erro); }
}

export async function retomarDevolucaoPedidoAction(id: string, tratamentoId: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  await exigirPermissao("financeiro.baixas", "editar");
  try { const { retomarDevolucaoPedido } = await import("@/lib/vendas/pedidos"); await retomarDevolucaoPedido(id, tratamentoId, chave, sessao); atualizar(id); return { ok: true as const }; } catch (erro) { return falha(erro); }
}
export async function concluirDevolucaoContextualAction(id: string, tratamentoId: string, contaId: string, data: string, evidencia: string, chave: string) {
  const sessao = await exigirPermissao("vendas.pedidos.cancelar", "editar");
  await exigirPermissao("financeiro.baixas", "editar");
  await exigirPermissao("financeiro.movimentacoes", "editar");
  try { const { concluirDevolucaoContextual } = await import("@/lib/vendas/pedidos"); await concluirDevolucaoContextual(id, tratamentoId, contaId, data, evidencia, chave, sessao); atualizar(id); return { ok: true as const }; } catch (erro) { return falha(erro); }
}
