import { FundoGestorPedidos } from "../gestor-conteudo";
import { filtrosDoRetornoGestor, retornoGestorSeguro } from "../pedidos-navegacao";
import { ConteudoGestaoPedidos } from "./conteudo";
import { PopupDiretoPedido } from "../popup-direto";

type Parametros = Parameters<typeof ConteudoGestaoPedidos>[0];
export default async function GestaoPage({ searchParams }: Parametros) {
  const retorno = retornoGestorSeguro((await searchParams).retorno);
  return <><FundoGestorPedidos searchParams={Promise.resolve(filtrosDoRetornoGestor(retorno))} /><PopupDiretoPedido><ConteudoGestaoPedidos searchParams={searchParams} /></PopupDiretoPedido></>;
}
