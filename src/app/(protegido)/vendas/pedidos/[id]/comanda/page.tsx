import { FundoGestorPedidos } from "../../gestor-conteudo";
import { filtrosDoRetornoGestor, retornoGestorSeguro } from "../../pedidos-navegacao";
import { ConteudoComanda } from "./conteudo";
import { PopupDiretoPedido } from "../../popup-direto";

export default async function ComandaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ retorno?: string }> }) {
  const retorno = retornoGestorSeguro((await searchParams)?.retorno);
  return <><FundoGestorPedidos searchParams={Promise.resolve(filtrosDoRetornoGestor(retorno))} /><PopupDiretoPedido><ConteudoComanda params={params} retorno={retorno} /></PopupDiretoPedido></>;
}
