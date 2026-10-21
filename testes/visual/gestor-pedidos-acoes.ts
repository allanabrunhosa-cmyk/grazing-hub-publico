import { validarInformacoesPedido } from "@/lib/vendas/pedidos-edicao";
import { validarMotivoCancelamento, validarResponsavelCancelamento } from "@/lib/vendas/cancelamento-pedido-dominio";
import { fixtureGestorVisual } from "./gestor-estado";

export * from "./pedidos-acoes";

export async function editarInformacoesPedidoAction(id: string, versao: number, entrada: unknown, _chave: string) {
  if (!_chave.trim()) return { erro: "Informe a chave da alteração fictícia." };
  const pedido = fixtureGestorVisual.resultado.pedidos.find(p => p.id === id);
  if (!pedido) return { erro: "Pedido fictício não encontrado." };
  if (pedido.versao !== versao) return { erro: "O pedido fictício mudou. Atualize antes de salvar." };
  try {
    const dados = validarInformacoesPedido(entrada);
    if (Object.hasOwn(dados, "previsaoData")) {
      pedido.previsaoData = dados.previsaoData ?? null;
      pedido.dataGestor = dados.previsaoData ?? null;
      pedido.previsaoJanela = dados.previsaoJanela ?? null;
    }
    if (Object.hasOwn(dados, "cobranca")) pedido.cobrancaSnapshot = dados.cobranca ?? null;
    if (Object.hasOwn(dados, "destinatario")) pedido.destinatarioSnapshot = dados.destinatario ?? null;
    pedido.versao += 1;
    return { ok: true as const, id, numero: pedido.numero, versao: pedido.versao, status: pedido.status };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Confira as informações fictícias antes de salvar." };
  }
}

export async function cancelarPedidoVendaAction(id: string, versao: number, motivo: string, _chave: string, _tratamento?: unknown, responsavelInformado?: string) {
  if (!_chave.trim()) return { erro: "Informe a chave do cancelamento fictício." };
  const pedido = fixtureGestorVisual.resultado.pedidos.find(p => p.id === id);
  if (!pedido) return { erro: "Pedido fictício não encontrado." };
  if (pedido.versao !== versao) return { erro: "O pedido fictício mudou. Atualize antes de cancelar." };
  try {
    validarResponsavelCancelamento(responsavelInformado);
    validarMotivoCancelamento(motivo);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Confira nome e motivo antes de cancelar." };
  }
  if (pedido.status !== "CONFIRMADO" || pedido.origem === "IFOOD" || pedido.operacional === "ENTREGUE") return { erro: "Este pedido fictício não permite cancelamento nesta etapa." };
  pedido.status = "CANCELADO";
  pedido.operacional = "INTERROMPIDO";
  pedido.versao += 1;
  return { ok: true as const, id, numero: pedido.numero, versao: pedido.versao, status: "CANCELADO" };
}
