"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Landmark, Loader2, Plus } from "lucide-react";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { StatusAtivoSalvavel } from "@/components/status-ativo";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { tipoMovimentacaoBancariaLabels } from "@/lib/labels";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { criarContaBancariaAction, alternarAtivoContaBancariaAction } from "@/app/(protegido)/financeiro/bancario/actions";
import type { ContaBancariaRow, MovimentacaoBancariaRow } from "@/app/(protegido)/financeiro/types";
import { CartoesView } from "./cartoes-view";
import type { CartaoOption } from "@/lib/financeiro/cartoes";
import { SaldoInicialDialog } from "./saldo-inicial-dialog";

function NovaContaDialog() {
  const id = useId();
  const acesso = useAcesso();
  const [erro, setErro] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setErro("");
      try {
      const resultado = await criarContaBancariaAction(null, formData);
      if ("erro" in resultado) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Conta bancária criada.");
      setOpen(false);
      } catch { setErro("Não foi possível criar a conta. Confira os dados antes de tentar novamente."); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-1.5" disabled={!acesso.pode("financeiro.bancario", "adicionar")}>
            <Plus className="size-4" />
            Nova Conta
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova conta bancária</DialogTitle>
          <DialogDescription>Controle manual — sem integração automática com o banco.</DialogDescription>
        </DialogHeader>
        <form onSubmit={evento => { evento.preventDefault(); handleSubmit(new FormData(evento.currentTarget)); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-nome`}>Nome</Label>
            <Input id={`${id}-nome`} name="nome" placeholder="Banco X — Conta Corrente" disabled={pending} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-saldo`}>Saldo Inicial</Label>
            <CurrencyInput id={`${id}-saldo`} name="saldoInicial" defaultValue={0} permitirNegativo disabled={pending} />
          </div>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContaCard({ conta, movimentacoes, podeEditarSaldo }: { conta: ContaBancariaRow; movimentacoes: MovimentacaoBancariaRow[]; podeEditarSaldo: boolean }) {
  const acesso = useAcesso();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="size-4" />
              {conta.nome}
            </CardTitle>
            <CardDescription>Saldo inicial: {formatarMoeda(conta.saldoInicial)}</CardDescription>
            <p className="mt-1 text-xs text-muted-foreground">{conta.dataSaldoInicial ? `Início do controle: ${new Date(`${conta.dataSaldoInicial}T12:00:00`).toLocaleDateString("pt-BR")}` : "Data do saldo inicial não definida"}</p>
          </div>
          <StatusAtivoSalvavel ativo={conta.ativo} nome={conta.nome} motivoBloqueio={!acesso.pode("financeiro.bancario", "editar") ? "Seu acesso não permite editar contas." : undefined} salvar={ativo => alternarAtivoContaBancariaAction(conta.id, ativo)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-heading text-2xl">{formatarMoeda(conta.saldoAtual)}</p>
        {podeEditarSaldo && <SaldoInicialDialog conta={conta} />}

        {movimentacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {movimentacoes.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-t pt-2 text-sm first:border-t-0 first:pt-0">
                <div>
                  <p>{m.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.data).toLocaleDateString("pt-BR")} · {tipoMovimentacaoBancariaLabels[m.tipo]}
                    {conta.dataSaldoInicial && m.data.slice(0, 10) < conta.dataSaldoInicial && " · Anterior ao início do controle"}
                  </p>
                </div>
                <Badge variant={m.tipo === "SAIDA" ? "destructive" : "success"}>
                  {m.tipo === "SAIDA" ? "−" : "+"} {formatarMoeda(m.valor)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ContasBancariasView({
  contas,
  cartoes = [],
  movimentacoesPorConta,
  podeEditarSaldo = false,
}: {
  contas: ContaBancariaRow[];
  cartoes?: CartaoOption[];
  movimentacoesPorConta: Record<string, MovimentacaoBancariaRow[]>;
  podeEditarSaldo?: boolean;
}) {
  return (
    <div className="space-y-4">
      <BarraAcoes titulo="Conta Bancária e Cartões" descricao="Contas, saldos e calendário dos cartões de crédito">
        <NovaContaDialog />
      </BarraAcoes>
      <CartoesView cartoes={cartoes} contas={contas} />
      {contas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Landmark className="size-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma conta bancária cadastrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contas.map((conta) => (
            <ContaCard key={conta.id} conta={conta} movimentacoes={movimentacoesPorConta[conta.id] ?? []} podeEditarSaldo={podeEditarSaldo} />
          ))}
        </div>
      )}
    </div>
  );
}
