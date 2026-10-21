"use client";
import { formatarQuantidadeEstoque } from "@/lib/estoque/quantidade";

import { useState, useTransition } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import { excluirPerdaAction } from "@/app/(protegido)/inventario/perdas/actions";
import type { PerdaRow } from "@/app/(protegido)/inventario/types";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";

export function ExcluirPerdaDialog({ perda, responsavelNome, aoFechar, aoExcluir }: {
  perda: PerdaRow;
  responsavelNome: string;
  aoFechar: () => void;
  aoExcluir: () => void;
}) {
  const [motivo, definirMotivo] = useState("");
  const [erro, definirErro] = useState("");
  const [salvando, iniciarTransicao] = useTransition();

  function confirmar() {
    if (salvando) return;
    if (motivo.trim().length < 3 || motivo.trim().length > 1000) {
      definirErro("Informe o motivo da exclusão com 3 a 1.000 caracteres.");
      return;
    }
    definirErro("");
    iniciarTransicao(async () => {
      try {
        const resultado = await excluirPerdaAction({ perdaId: perda.id, motivo: motivo.trim() });
        if ("erro" in resultado) { definirErro(resultado.erro); return; }
        toast.success("Perda excluída e quantidade devolvida ao estoque.");
        aoExcluir();
      } catch {
        definirErro("Não foi possível confirmar a exclusão. Atualize a página para conferir antes de tentar novamente.");
      }
    });
  }

  return <Dialog open onOpenChange={(aberto) => !aberto && !salvando && aoFechar()}>
    <DialogContent showCloseButton={!salvando} className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Excluir registro de perda?</DialogTitle>
        <DialogDescription>O registro sairá da lista de perdas. A exclusão, o motivo e os responsáveis ficarão no histórico restrito aos administradores.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <IdentificacaoInsumo nome={perda.insumoNome} especificacao={perda.insumoEspecificacao} nomeClassName="font-medium" />
          <p className="text-sm text-muted-foreground">{new Date(perda.data).toLocaleDateString("pt-BR")} · {perda.localNome}</p>
          <p className="flex items-start gap-2 text-sm"><Undo2 className="mt-0.5 size-4 shrink-0" /><span>Serão devolvidos ao estoque <strong>{formatarQuantidadeEstoque(perda.quantidade)} {unidadeMedidaAbreviada[perda.unidade]}</strong> no local desta perda.</span></p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exclusao-perda-motivo">Motivo da exclusão</Label>
          <Textarea id="exclusao-perda-motivo" value={motivo} onChange={(evento) => definirMotivo(evento.target.value)} placeholder="Ex.: perda lançada duas vezes por engano" required minLength={3} maxLength={1000} rows={3} disabled={salvando} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Responsável pela exclusão</p>
          <p className="break-words font-medium">{responsavelNome || "Usuário conectado"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Registrado automaticamente com o usuário conectado.</p>
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={salvando} onClick={aoFechar}>Voltar</Button>
        <Button variant="destructive" disabled={salvando} onClick={confirmar}>{salvando && <Loader2 className="size-4 animate-spin" />}Excluir e devolver ao estoque</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
