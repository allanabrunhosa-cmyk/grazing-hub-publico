"use client";
import type { ReactNode } from "react";
import { ModalPedido } from "../../modal-pedido";

export function ModalNovoPedido({ children, retorno }: { children: ReactNode; retorno?: string }) {
  return <ModalPedido titulo="Novo pedido" descricao="Preencha e confirme pelos botões do formulário. A confirmação gera as obrigações internas; registre os recebimentos separadamente." retorno={retorno} protegerAlteracoes>{children}</ModalPedido>;
}
