"use server";

import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarHistoricoPedidosCliente } from "@/lib/vendas/clientes-consulta";

export async function consultarHistoricoPedidosClienteAction(clienteId: string, pagina = 1) {
  await exigirPermissao("vendas.clientes");
  await exigirPermissao("vendas.pedidos");
  if (typeof clienteId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(clienteId)) return { erro: "Cliente inválido. Reabra o cadastro para consultar os pedidos." };
  try {
    return await consultarHistoricoPedidosCliente(clienteId, pagina);
  } catch {
    return { erro: "Não foi possível consultar os pedidos. Tente novamente." };
  }
}
