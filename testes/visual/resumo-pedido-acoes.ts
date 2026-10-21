import { dadosResumoPedido } from "@/lib/vendas/resumo-pedido";
import { criarGestorFixture } from "./gestor-fixtures";
import { criarDetalheFixture } from "./pedido-detalhe-fixture";

/** Consulta inteiramente sintética para revisão visual, sem banco nem autorização real. */
export async function consultarResumoPedidoAction(id: string) {
  const parametros = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
  const pedido = criarGestorFixture({ referencia: parametros?.has("referencia") ?? false }).resultado.pedidos.find(p => p.id === id) ?? criarDetalheFixture();
  const dados = dadosResumoPedido(pedido);
  const orcamento = parametros?.has("orcamento") ?? false;
  return { dados: { ...dados, status: orcamento ? "RASCUNHO" : dados.status, cliente: { ...dados.cliente, tipo: "PJ", empresa: "Empresa de exemplo Ltda.", documento: "00.000.000/0000-00", contato: "Contato de exemplo", email: "contato@example.test" } } };
}
