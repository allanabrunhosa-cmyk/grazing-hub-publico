"use client";
import { DATA_LANCAMENTO_MIN, DATA_LANCAMENTO_MAX } from "@/lib/financeiro/data-lancamento";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { editarSaldoInicialAction } from "@/app/(protegido)/financeiro/bancario/actions";
import type { ContaBancariaRow } from "../types";

export function SaldoInicialDialog({ conta }: { conta: ContaBancariaRow }) {
  const [aberto, definirAberto] = useState(false);
  const [salvando, iniciarTransicao] = useTransition();
  const [erro, definirErro] = useState("");

  function salvar(formulario: FormData) {
    definirErro("");
    iniciarTransicao(async () => {
      try {
        const resultado = await editarSaldoInicialAction(conta.id, formulario);
        if ("erro" in resultado) { definirErro(resultado.erro); return; }
        toast.success("Saldo inicial atualizado.");
        definirAberto(false);
      } catch { definirErro("Não foi possível salvar. Tente novamente."); }
    });
  }

  return <Dialog open={aberto} onOpenChange={(valor) => { if (!salvando) { definirAberto(valor); definirErro(""); } }}>
    <DialogTrigger render={<Button variant="editar" aria-label="Editar saldo inicial" />}><Pencil className="size-3.5" /></DialogTrigger>
    <DialogContent className="sm:max-w-md" showCloseButton={!salvando}>
      <DialogHeader><DialogTitle>Editar saldo inicial</DialogTitle><DialogDescription>{conta.nome} · Apenas administradores</DialogDescription></DialogHeader>
      <form action={salvar} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`saldo-${conta.id}`}>Saldo inicial</Label>
          <CurrencyInput id={`saldo-${conta.id}`} name="saldoInicial" permitirNegativo defaultValue={conta.saldoInicial} placeholder="0,00" required disabled={salvando} aria-describedby={`ajuda-saldo-${conta.id}`} />
          <p id={`ajuda-saldo-${conta.id}`} className="text-xs text-muted-foreground">Digite apenas números: 2590 corresponde a 25,90. Se necessário, selecione Negativo.</p>
        </div>
        <div className="space-y-1.5"><Label htmlFor={`data-saldo-${conta.id}`}>Data do saldo inicial</Label><Input id={`data-saldo-${conta.id}`} name="dataSaldoInicial" type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX} defaultValue={conta.dataSaldoInicial ?? ""} required disabled={salvando} /></div>
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Informe o saldo no início dessa data. As movimentações do dia em diante serão somadas a ele. As anteriores permanecem no histórico, sem serem somadas novamente.</p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={salvando} onClick={() => definirAberto(false)}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando && <Loader2 className="size-4 animate-spin" />}Salvar saldo inicial</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
