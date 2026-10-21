import { ConteudoNovoPedido } from "../../novo/conteudo";
import { ModalNovoPedido } from "./modal-novo-pedido";
import { retornoGestorSeguro } from "../../pedidos-navegacao";

export default async function NovoPedidoInterceptado({ searchParams }: { searchParams: Promise<{ data?: string; retorno?: string }> }) {
  return <ModalNovoPedido retorno={retornoGestorSeguro((await searchParams).retorno)}><ConteudoNovoPedido searchParams={searchParams} modal /></ModalNovoPedido>;
}
