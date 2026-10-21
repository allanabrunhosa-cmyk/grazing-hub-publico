"use client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModalPedido } from "./modal-pedido";
import { retornoGestorSeguro } from "./pedidos-navegacao";
import { PopupDiretoPedido } from "./popup-direto";

export function CarregandoPopupPedido() {
  const retorno = retornoGestorSeguro(useSearchParams().get("retorno"));
  return <ModalPedido titulo="Carregando conteúdo" descricao="O Gestor permanece disponível ao fechar esta janela." retorno={retorno}><p role="status">Carregando…</p></ModalPedido>;
}

export function ErroPopupPedido({ reset }: { reset: () => void }) {
  const retorno = retornoGestorSeguro(useSearchParams().get("retorno"));
  return <ModalPedido titulo="Não foi possível carregar" descricao="Feche a janela para retornar ao Gestor ou tente consultar novamente." retorno={retorno}><p role="alert">O conteúdo não está disponível agora. Feche a janela e consulte o pedido novamente.</p><Button type="button" variant="outline" onClick={reset}>Tentar novamente</Button></ModalPedido>;
}

export function ErroPopupDiretoPedido(props: { reset: () => void }) {
  return <PopupDiretoPedido><ErroPopupPedido {...props} /></PopupDiretoPedido>;
}
