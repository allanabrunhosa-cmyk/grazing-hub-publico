import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { EditorPedido } from "../editor-pedido";
import { dadosEditorPedido } from "../dados-editor";

export async function ConteudoNovoPedido({ searchParams, modal = false }: { searchParams: Promise<{ data?: string }>; modal?: boolean }) {
  if (modal && !await podeAcessar("vendas.pedidos", "adicionar")) return <p role="alert">Seu perfil não possui permissão para criar pedidos.</p>;
  await exigirPermissao("vendas.pedidos", "adicionar");
  const [dados, confirmar, revisar, desconto, preco, cancelar, criarCliente, editarCliente] = await Promise.all([
    dadosEditorPedido(true), podeAcessar("vendas.pedidos.confirmar", "editar"), podeAcessar("vendas.pedidos.revisar", "editar"),
    podeAcessar("vendas.pedidos.desconto", "editar"), podeAcessar("vendas.pedidos.preco", "editar"), podeAcessar("vendas.pedidos.cancelar", "editar"), podeAcessar("vendas.clientes", "adicionar"), podeAcessar("vendas.clientes", "editar"),
  ]);
  const data = (await searchParams).data;
  return <EditorPedido emDialogo={modal} dataInicial={data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined} dados={dados} capacidades={{ rascunho: true, confirmar, revisar, desconto, preco, cancelar, receber: false, condicao: false, criarCliente, editarCliente }} />;
}
