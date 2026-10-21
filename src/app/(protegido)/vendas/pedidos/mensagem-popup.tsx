import { ModalPedido } from "./modal-pedido";

export function MensagemPopupPedido({ titulo, mensagem, retorno }: { titulo: string; mensagem: string; retorno?: string }) {
  return <ModalPedido titulo={titulo} descricao="Feche esta janela para retornar ao Gestor." retorno={retorno}><p role="alert">{mensagem}</p></ModalPedido>;
}
