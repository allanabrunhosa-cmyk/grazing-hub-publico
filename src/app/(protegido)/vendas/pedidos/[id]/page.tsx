import { FundoGestorPedidos } from "../gestor-conteudo";
import { filtrosDoRetornoGestor, retornoGestorSeguro } from "../pedidos-navegacao";
import { ConteudoPedido } from "./conteudo";
import { PopupDiretoPedido } from "../popup-direto";

export default async function PedidoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retorno?: string; cancelar?: string }> }) {
  const consultas = await searchParams;
  const retorno = retornoGestorSeguro(consultas.retorno);
  return <><FundoGestorPedidos searchParams={Promise.resolve(filtrosDoRetornoGestor(retorno))} /><PopupDiretoPedido><ConteudoPedido params={params} retorno={retorno} abrirCancelamentoInicial={consultas.cancelar === "1"} /></PopupDiretoPedido></>;
}
