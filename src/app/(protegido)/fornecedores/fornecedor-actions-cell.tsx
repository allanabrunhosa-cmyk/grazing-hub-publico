"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { useAcesso } from "@/components/layout/acesso-contexto";
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
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";
import { BeneficiarioDialog } from "@/app/(protegido)/fornecedores/beneficiario-dialog";
import { deleteFornecedorAction, excluirBeneficiarioAction } from "@/app/(protegido)/fornecedores/actions";
import type { FornecedorRow, SimpleOption } from "@/app/(protegido)/fornecedores/types";

export function FornecedorActionsCell({
  fornecedor,
  canaisPedidoOptions,
  formasPagamentoOptions,
}: {
  fornecedor: FornecedorRow;
  canaisPedidoOptions: SimpleOption[];
  formasPagamentoOptions: SimpleOption[];
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { pode } = useAcesso();
  const [isPending, startTransition] = useTransition();
  const beneficiario = fornecedor.tipoCadastro === "BENEFICIARIO";
  const rotulo = beneficiario ? "beneficiário" : "fornecedor";

  function handleDelete() {
    startTransition(async () => {
      try {
        if (beneficiario) {
          const resultado = await excluirBeneficiarioAction(fornecedor.id);
          if ("erro" in resultado) throw new Error(resultado.erro);
        } else {
          await deleteFornecedorAction(fornecedor.id);
        }
        toast.success(`${beneficiario ? "Beneficiário" : "Fornecedor"} excluído.`);
        setConfirmOpen(false);
      } catch {
        toast.error(
          beneficiario
            ? "Não foi possível excluir. Verifique se não há lançamentos ligados a este beneficiário."
            : "Não foi possível excluir. Verifique se não há pedidos ligados a este fornecedor."
        );
      }
    });
  }

  return (
    <GrupoAcoes nome={`Ações de ${fornecedor.nome}`} className="justify-end">
      {pode("fornecedores", "editar") && (beneficiario ? (
        <BeneficiarioDialog
          beneficiario={fornecedor}
          formasPagamentoOptions={formasPagamentoOptions}
          trigger={<Button aria-label="Editar beneficiário" variant="editar" size="icon-sm" />}
        />
      ) : (
        <FornecedorDialog
          fornecedor={fornecedor}
          canaisPedidoOptions={canaisPedidoOptions}
          formasPagamentoOptions={formasPagamentoOptions}
          trigger={<Button aria-label="Editar fornecedor" variant="editar" size="icon-sm" />}
        />
      ))}

      {pode("fornecedores", "excluir") && <Button
        variant="excluir"
        size="icon-sm"
        aria-label={`Excluir ${rotulo}`}
        onClick={() => setConfirmOpen(true)}
      />}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir {rotulo}?</DialogTitle>
            <DialogDescription>
              Tem certeza que quer excluir <strong>{fornecedor.nome}</strong>? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancelar</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GrupoAcoes>
  );
}
