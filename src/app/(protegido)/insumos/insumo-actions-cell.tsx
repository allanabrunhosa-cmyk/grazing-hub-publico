"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { consultarExclusaoInsumoAction, deleteInsumoAction } from "@/app/(protegido)/insumos/actions";
import { temVinculosExclusaoInsumo, type VinculosExclusaoInsumo } from "@/lib/insumos/exclusao";
import type { InsumoRow } from "@/app/(protegido)/insumos/types";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";

export function InsumoActionsCell({ insumo, edicao }: { insumo: InsumoRow; edicao?: ReactNode }) {
  const excluir = useAcesso().pode("insumos", "excluir");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [vinculos, setVinculos] = useState<VinculosExclusaoInsumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const bloqueado = !vinculos?.revisao;

  function abrirConfirmacao() {
    setVinculos(null);
    setErro(null);
    setConfirmOpen(true);
    startTransition(async () => {
      try {
        const resultado = await consultarExclusaoInsumoAction(insumo.id);
        setVinculos(resultado.vinculos ?? null);
        setErro(resultado.error);
      } catch {
        setErro("Não foi possível verificar os vínculos. Volte e tente novamente.");
      }
    });
  }

  function handleDelete() {
    if (isPending || bloqueado) return;
    startTransition(async () => {
      try {
        const result = await deleteInsumoAction(insumo.id, vinculos?.revisao);
        if (result.error) {
          setErro(result.error);
          if (result.vinculos) setVinculos(result.vinculos);
        } else {
          toast.success("Item excluído.");
          setConfirmOpen(false);
        }
      } catch { setErro("Não foi possível excluir. O item foi mantido. Volte e tente novamente."); }
    });
  }

  return (
    <GrupoAcoes nome={`Ações de ${insumo.nome}`} className="justify-end">
      {edicao}
      {excluir && <Button
        variant="excluir"
        size="icon-sm"
        aria-label="Excluir item"
        onClick={abrirConfirmacao}
      />}

      <Dialog open={confirmOpen} onOpenChange={aberto => { if (!isPending) setConfirmOpen(aberto); }} protegerAlteracoes={false}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir item?</DialogTitle>
            <DialogDescription>
              O item será retirado do cadastro. Históricos de vendas, compras, perdas, estoque e pedidos existentes serão preservados.
            </DialogDescription>
            <IdentificacaoInsumo nome={insumo.nome} especificacao={insumo.especificacao} nomeClassName="font-semibold text-foreground" />
          </DialogHeader>
          {isPending && !vinculos && <p role="status" className="text-sm text-muted-foreground">Verificando vínculos…</p>}
          {vinculos && temVinculosExclusaoInsumo(vinculos) && <div className="max-h-[40vh] space-y-3 overflow-y-auto text-sm">
            {([
              ["Preparações", vinculos.preparacoes],
              ["Complementos", vinculos.complementos],
              ["Produtos", vinculos.produtos],
            ] as const).map(([titulo, itens]) => itens.length > 0 && <div key={titulo}>
              <p className="font-semibold">{titulo}</p>
              <ul className="list-disc pl-5">{itens.map(item => <li key={item.id}>{item.nome}</li>)}</ul>
            </div>)}
            {(vinculos.preparacoes.length > 0 || vinculos.complementos.length > 0 || vinculos.produtos.length > 0) && <p>
              Ao confirmar, este insumo será removido das fichas técnicas e composições indicadas. Os demais ingredientes serão mantidos.
            </p>}
          </div>}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Voltar</DialogClose>
            <Button type="button" variant="destructive" aria-label="Confirmar exclusão" onClick={handleDelete} disabled={isPending || bloqueado}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GrupoAcoes>
  );
}
