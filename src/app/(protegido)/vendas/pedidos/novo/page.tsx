import { ConteudoNovoPedido } from "./conteudo";
import { FundoGestorPedidos } from "../gestor-conteudo";
import { filtrosDoRetornoGestor, retornoGestorSeguro } from "../pedidos-navegacao";
import { ModalNovoPedido } from "../@modal/(.)novo/modal-novo-pedido";
import { PopupDiretoPedido } from "../popup-direto";

export default async function NovoPedidoPage({ searchParams }: { searchParams: Promise<{ data?: string; retorno?: string }> }) {
  const retorno = retornoGestorSeguro((await searchParams).retorno);
  return <><FundoGestorPedidos searchParams={Promise.resolve(filtrosDoRetornoGestor(retorno))} /><PopupDiretoPedido><ModalNovoPedido retorno={retorno}><ConteudoNovoPedido searchParams={searchParams} modal /></ModalNovoPedido></PopupDiretoPedido></>;
}
