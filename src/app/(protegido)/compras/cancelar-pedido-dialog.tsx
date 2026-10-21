"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelarPedidoAction } from "@/app/(protegido)/compras/actions";
import { formatarNumeroPedido, type PedidoRow } from "@/app/(protegido)/compras/types";

export function CancelarPedidoDialog({
  pedido,
  open,
  onOpenChange,
}: {
  pedido: PedidoRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [responsavel, setResponsavel] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const resultado = await cancelarPedidoAction({ pedidoId: pedido.id, responsavel, justificativa });
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Pedido cancelado.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="size-5" />
            Cancelar pedido {formatarNumeroPedido(pedido.numero)}
          </DialogTitle>
          <DialogDescription>Essa ação é definitiva perante o pedido — não pode ser desfeita.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label>Justificativa</Label>
            <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={3} disabled={pending} />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Voltar</DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleSubmit}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
