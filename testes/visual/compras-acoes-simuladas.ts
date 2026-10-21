export async function salvarPedidoAction() { return { ok: true, pedidoId: "simulado" }; }
export async function confirmarRecebimentoAction() { return { ok: true, recebimentoId: "simulado" }; }
export async function reabrirPedidoAction() { return { ok: true }; }
export async function cancelarPedidoAction() { return { ok: true }; }
export async function excluirPedidoAction() { return { ok: true }; }

export async function reagendarPedidoAction(input: { previsaoEntrega: string }) { return { ok: true as const, previsaoEntrega: input.previsaoEntrega + "T12:00:00.000Z" }; }
