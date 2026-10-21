"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { excluirContagemAction } from "@/app/(protegido)/inventario/contagem/actions";
import type { ContagemListRow } from "@/app/(protegido)/inventario/types";

type Resumo = Pick<ContagemListRow, "id" | "localNome" | "dataContagem" | "status">;

export function ExcluirContagemDialog({ contagem, aoFechar, aoExcluir }: {
  contagem: Resumo; aoFechar: () => void; aoExcluir: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciarExclusao] = useTransition();
  const finalizada = contagem.status === "FINALIZADO";
  function confirmar() {
    iniciarExclusao(async () => {
      setErro(null);
      try {
        const resultado = finalizada
          ? await excluirContagemAction(contagem.id, { confirmarEstorno: true, motivo: motivo.trim() })
          : await excluirContagemAction(contagem.id);
        if ("erro" in resultado) { setErro(resultado.erro); toast.error(resultado.erro); return; }
        toast.success(finalizada ? "Contagem cancelada. Ajustes estornados e histórico preservado." : "Contagem excluída.");
        aoExcluir(); aoFechar();
      } catch { setErro("Não foi possível excluir a contagem. Tente novamente."); }
    });
  }
  return <Dialog open onOpenChange={aberto => { if (!aberto && !excluindo) aoFechar(); }}>
    <DialogContent showCloseButton={!excluindo} className={`max-h-[calc(100dvh-2rem)] overflow-y-auto ${finalizada ? "sm:max-w-lg" : "sm:max-w-sm"}`}>
      <DialogHeader>
        <DialogTitle className={finalizada ? "flex items-center gap-2 pr-6 text-destructive" : undefined}>
          {finalizada && <AlertTriangle className="size-5 shrink-0" />} {finalizada ? "Cancelar contagem finalizada?" : "Excluir contagem?"}
        </DialogTitle>
        <DialogDescription>
          <strong>{contagem.localNome}</strong> · {new Date(contagem.dataContagem).toLocaleDateString("pt-BR")}
          {!finalizada && <>. Ela ficará disponível somente no filtro Excluídas, sem alterar o saldo do estoque. Essa ação não pode ser desfeita.</>}
        </DialogDescription>
      </DialogHeader>
      {finalizada && <>
        <div className="space-y-2 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Atenção: esta ação altera o estoque.</p>
          <ul className="list-disc space-y-2 pl-4 text-foreground">
            <li>Todos os ajustes desta contagem serão desfeitos: entradas serão retiradas e saídas serão devolvidas ao mesmo local.</li>
            <li>Movimentações posteriores serão mantidas. O saldo poderá ficar negativo se o estoque já tiver sido utilizado.</li>
            <li>A contagem irá para <strong>Excluídas</strong>. O histórico e os estornos ficarão registrados com seu nome, data e motivo.</li>
          </ul>
          <p className="font-medium text-destructive">O cancelamento não pode ser desfeito.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="motivo-cancelamento-contagem">Motivo do cancelamento</Label>
          <Textarea id="motivo-cancelamento-contagem" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={1000}
            disabled={excluindo} placeholder="Ex.: contagem finalizada com quantidades incorretas" rows={2} />
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-5">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-red-600" checked={ciente} disabled={excluindo} onChange={e => setCiente(e.target.checked)} />
          Estou ciente de que os ajustes serão estornados e os saldos do estoque serão alterados.
        </label>
      </>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={excluindo} onClick={aoFechar}>{finalizada ? "Manter contagem" : "Cancelar"}</Button>
        <Button type="button" variant="destructive" disabled={excluindo || (finalizada && (!ciente || motivo.trim().length < 3))} onClick={confirmar}>
          {excluindo && <Loader2 className="size-4 animate-spin" />}{finalizada ? "Cancelar e estornar ajustes" : "Sim, excluir"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
