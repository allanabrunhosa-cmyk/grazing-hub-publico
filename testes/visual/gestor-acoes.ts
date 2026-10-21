import { fixtureGestorVisual } from "./gestor-estado";
const estados = fixtureGestorVisual.resultado.pedidos;
let configuracaoEstoque = fixtureGestorVisual.configuracaoEstoque!;
export async function salvarMovimentacaoEstoqueGestorPedidosAction(movimentarEstoque: boolean, versao: number, _chave: string, localMovimentarEstoqueId?: string | null) {
  if (versao !== configuracaoEstoque.versao) return { erro: "A configuração fictícia mudou. Reabra para conferir." };
  if (movimentarEstoque && !configuracaoEstoque.locais.some(local => local.id === localMovimentarEstoqueId)) return { erro: "Selecione um estoque fictício." };
  configuracaoEstoque = { ...configuracaoEstoque, movimentarEstoque, localMovimentarEstoqueId: localMovimentarEstoqueId ?? null, versao: versao + 1 };
  return { ok: true as const, movimentarEstoque, localMovimentarEstoqueId: configuracaoEstoque.localMovimentarEstoqueId, versao: configuracaoEstoque.versao };
}
export async function mudarStatusGestorPedidoAction(id: string, versao: number, direcao: string) {
  const pedido = estados.find(p => p.id === id);
  if (!pedido) return { erro: "Pedido fictício não encontrado." };
  if (pedido.versao !== versao) return { erro: "O pedido fictício mudou. Atualize antes de alterar a etapa." };
  const avancar: Record<string, string> = { PENDENTE: "EM_PREPARO", EM_PREPARO: "PRONTO", PRONTO: "EM_ENTREGA", EM_ENTREGA: "ENTREGUE" };
  const voltar: Record<string, string> = { PRONTO: "EM_PREPARO", EM_ENTREGA: "PRONTO", ENTREGUE: "EM_ENTREGA" };
  const proxima = (direcao === "avancar" ? avancar : voltar)[pedido.operacional];
  if (pedido.status !== "CONFIRMADO" || !proxima) return { erro: "Etapa fictícia indisponível." };
  pedido.operacional = proxima;
  pedido.versao += 1;
  return { ok: true as const, id, numero: pedido.numero, versao: pedido.versao, status: "CONFIRMADO", statusOperacional: pedido.operacional };
}
