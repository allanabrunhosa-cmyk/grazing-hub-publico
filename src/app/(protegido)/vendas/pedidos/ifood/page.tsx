import { FundoGestorPedidos } from "../gestor-conteudo";
import { PopupDiretoPedido } from "../popup-direto";
import { ConteudoConfiguracaoIfood } from "./conteudo";
export default function IfoodPage() {
  return <><FundoGestorPedidos searchParams={Promise.resolve({})} /><PopupDiretoPedido><ConteudoConfiguracaoIfood /></PopupDiretoPedido></>;
}
