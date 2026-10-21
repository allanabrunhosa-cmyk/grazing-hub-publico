import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { consultarClientesVenda, consultarDestinoClienteUnificado } from "@/lib/vendas/clientes-consulta";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";
import { ClientesVenda } from "./clientes-client";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ busca?: string; pagina?: string; situacao?: string; entidade?: string | string[] }> }) {
  await exigirPermissao("vendas.clientes");
  const parametros = await searchParams;
  const busca = String(parametros.busca ?? "").slice(0, 160);
  const pagina = Math.min(100000, Math.max(1, Number.parseInt(parametros.pagina ?? "1") || 1));
  const situacao = parametros.situacao === "todos" ? "todos" : parametros.situacao === "inativos" ? "inativos" : "ativos";
  const [adicionar, editar, verPedidos, verCredito, ajustarFinanceiro, baixar, cancelarPedido] = await Promise.all([
    podeAcessar("vendas.clientes", "adicionar"), podeAcessar("vendas.clientes", "editar"),
    podeAcessar("vendas.pedidos", "visualizar"), podeAcessar("financeiro.movimentacoes", "visualizar"),
    podeAcessar("financeiro.movimentacoes", "editar"), podeAcessar("financeiro.baixas", "editar"),
    podeAcessar("vendas.pedidos.cancelar", "editar"),
  ]);
  const { clientes, formasPagamento, creditos, fusoHorario } = await consultarClientesVenda({ verPedidos, verCredito });
  const entidadeId = entidadeInicial(parametros.entidade);
  const direto = clientes.some(c => c.id === entidadeId);
  const destino = entidadeId && !direto ? await consultarDestinoClienteUnificado(entidadeId) : null;
  const entidadeInicialId = direto ? entidadeId : clientes.some(c => c.id === destino) ? destino! : undefined;
  return <ClientesVenda key={entidadeInicialId ?? "lista"} {...{ clientes, formasPagamento, fusoHorario, total: clientes.length, pagina, busca, situacao, entidadeInicialId, adicionar, editar, verPedidos, creditos, ajustarCredito: ajustarFinanceiro && baixar && cancelarPedido }} />;
}
