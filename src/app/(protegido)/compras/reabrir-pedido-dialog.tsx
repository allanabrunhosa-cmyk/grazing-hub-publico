"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reabrirPedidoAction } from "@/app/(protegido)/compras/actions";
import { formatarNumeroPedido, type PedidoRow } from "./types";

export function ReabrirPedidoDialog({ pedido, onOpenChange }: { pedido: PedidoRow; onOpenChange: (aberto: boolean) => void }) {
  const [motivo, setMotivo] = useState("");
  const [salvando, iniciar] = useTransition();
  return <Dialog open onOpenChange={aberto => !salvando && onOpenChange(aberto)}>
    <DialogContent><DialogHeader><DialogTitle>Reabrir pedido {formatarNumeroPedido(pedido.numero)}</DialogTitle>
      <DialogDescription>O pedido voltará a pendente para edição e nova conferência. O recebimento anterior e o motivo da mudança ficam no histórico. Estoque e financeiro permanecem como estão.</DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor="motivo-reabertura">Motivo da reabertura</Label><Textarea id="motivo-reabertura" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={1000} disabled={salvando} placeholder="Descreva o que precisa ser corrigido ou conferido novamente" /></div>
      <DialogFooter><DialogClose render={<Button variant="outline" disabled={salvando} />}>Voltar</DialogClose>
        <Button disabled={salvando || motivo.trim().length < 5} onClick={() => iniciar(async () => {
          const resultado = await reabrirPedidoAction({ pedidoId: pedido.id, motivo });
          if ("erro" in resultado) return void toast.error(resultado.erro);
          toast.success("Pedido reaberto. A mudança foi registrada no histórico.");
          onOpenChange(false);
        })}>{salvando ? "Reabrindo…" : "Reabrir pedido"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
