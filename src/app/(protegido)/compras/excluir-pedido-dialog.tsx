"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { excluirPedidoAction } from "@/app/(protegido)/compras/actions";
import { formatarNumeroPedido, type PedidoRow } from "./types";

export function ExcluirPedidoDialog({ pedido, aoFechar, aoExcluir }: { pedido: PedidoRow; aoFechar: () => void; aoExcluir: () => void }) {
  const [salvando, iniciarTransicao] = useTransition();
  const [erro, definirErro] = useState("");
  function confirmar() {
    iniciarTransicao(async () => {
      try {
        const resultado = await excluirPedidoAction(pedido.id);
        if ("erro" in resultado) { definirErro(resultado.erro); return; }
        toast.success("Pedido excluído. O histórico foi preservado.");
        aoExcluir();
      } catch { definirErro("Não foi possível excluir o pedido. Tente novamente."); }
    });
  }
  return <Dialog open onOpenChange={aberto => !aberto && !salvando && aoFechar()}>
    <DialogContent showCloseButton={!salvando} className="sm:max-w-md">
      <DialogHeader><DialogTitle>Excluir pedido {formatarNumeroPedido(pedido.numero)}?</DialogTitle>
        <DialogDescription>{pedido.fornecedorNome}. O pedido sairá da lista e do calendário. Seus itens e recebimentos continuarão disponíveis no filtro Excluídos.</DialogDescription></DialogHeader>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" disabled={salvando} onClick={aoFechar}>Voltar</Button><Button variant="destructive" disabled={salvando} onClick={confirmar}>{salvando && <Loader2 className="size-4 animate-spin" />}Confirmar exclusão</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
