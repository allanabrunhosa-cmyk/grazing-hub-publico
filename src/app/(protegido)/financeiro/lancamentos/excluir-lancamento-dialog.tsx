"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { excluirLancamentoAction, obterResumoExclusaoLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";
import type { EscopoExclusaoLancamento, ResumoExclusaoLancamento } from "@/lib/financeiro/exclusaoLancamento";
import { ReversaoCompraAviso } from "@/components/financeiro/reversao-compra-aviso";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Montar somente enquanto houver um id selecionado, usando key={lancamentoId}.
export function ExcluirLancamentoDialog({ lancamentoId, aoFechar, aoExcluir }: {
  lancamentoId: string; aoFechar: () => void; aoExcluir?: () => void;
}) {
  const [resumo, definirResumo] = useState<ResumoExclusaoLancamento | null>(null);
  const [escopo, definirEscopo] = useState<EscopoExclusaoLancamento | null>(null);
  const [erro, definirErro] = useState("");
  const [motivo, definirMotivo] = useState("");
  const [salvando, iniciarTransicao] = useTransition();
  useEffect(() => {
    let ativa = true;
    obterResumoExclusaoLancamentoAction(lancamentoId).then((resultado) => {
      if (!ativa) return;
      if ("erro" in resultado) definirErro(resultado.erro);
      else definirResumo(resultado);
    }).catch(() => { if (ativa) definirErro("Não foi possível consultar as parcelas. Feche e tente novamente."); });
    return () => { ativa = false; };
  }, [lancamentoId]);

  function confirmar() {
    if (!resumo || (resumo.grupo && !escopo) || (resumo.compra && (resumo.compra.cancelada || motivo.trim().length < 15 || motivo.trim().length > 255))) return;
    iniciarTransicao(async () => {
      definirErro("");
      try {
        const resultado = resumo.compra
          ? await excluirLancamentoAction(lancamentoId, "COMPRA_INTEGRAL", { token: resumo.compra.token, motivo: motivo.trim() })
          : await excluirLancamentoAction(lancamentoId, escopo ?? "APENAS_ESTA");
        if ("erro" in resultado) { definirErro(resultado.erro); return; }
        toast.success(resultado.quantidade === 1 ? "Movimentação excluída." : `${resultado.quantidade} movimentações excluídas.`);
        aoExcluir?.();
        aoFechar();
      } catch { definirErro("Não foi possível excluir. Tente novamente."); }
    });
  }

  return <Dialog open onOpenChange={(aberto) => !aberto && !salvando && aoFechar()}>
    <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto" showCloseButton={!salvando}>
      <DialogHeader><DialogTitle>{resumo?.compra ? "Cancelar compra inteira?" : "Excluir movimentação?"}</DialogTitle><DialogDescription>{resumo?.descricao ?? "Consultando a movimentação e suas parcelas…"}</DialogDescription></DialogHeader>
      {!resumo && !erro && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" />Carregando parcelas e recorrências…</p>}
      {resumo?.compra && <>
        <ReversaoCompraAviso resumo={resumo.compra} />
        <div className="space-y-2"><Label htmlFor="motivo-cancelamento-compra">Motivo do cancelamento (15 a 255 caracteres)</Label><Textarea id="motivo-cancelamento-compra" value={motivo} onChange={e => definirMotivo(e.target.value)} maxLength={255} disabled={salvando} /></div>
      </>}
      {resumo && !resumo.compra && (resumo.grupo ? <>
        <fieldset disabled={salvando} className="space-y-3">
          <legend className="mb-3 text-sm font-medium">Deseja excluir as outras parcelas ou recorrências, ou apenas esta?</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"><input type="radio" name="escopo-exclusao" className="mt-1" checked={escopo === "APENAS_ESTA"} onChange={() => definirEscopo("APENAS_ESTA")} /><span><strong className="block">Apenas esta movimentação</strong><span className="text-muted-foreground">As outras parcelas e recorrências permanecem.</span></span></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"><input type="radio" name="escopo-exclusao" className="mt-1" checked={escopo === "GRUPO_PENDENTE"} onChange={() => definirEscopo("GRUPO_PENDENTE")} /><span><strong className="block">Todas as pendentes deste grupo ({resumo.pendentes})</strong><span className="text-muted-foreground">Inclui esta e as demais pendentes, mesmo fora do período exibido.{resumo.grupo === "PARCELAS_NOTA" && " Somente parcelas deste item da nota fiscal."}</span></span></label>
        </fieldset>
        <p className="text-sm text-muted-foreground">{resumo.realizados === 1 ? "1 movimentação já realizada será preservada." : resumo.realizados > 1 ? `${resumo.realizados} movimentações já realizadas serão preservadas.` : "Movimentações já realizadas não serão excluídas."}</p>
      </> : <p className="text-sm text-muted-foreground">Esta movimentação deixará de contar no extrato e nos relatórios.</p>)}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" disabled={salvando} onClick={aoFechar}>Voltar</Button><Button variant="destructive" disabled={salvando || !resumo || (!!resumo.grupo && !escopo) || (!!resumo.compra && (resumo.compra.cancelada || motivo.trim().length < 15 || motivo.trim().length > 255))} onClick={confirmar}>{salvando && <Loader2 className="size-4 animate-spin" />}{resumo?.compra ? "Confirmar cancelamento integral" : "Confirmar exclusão"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
