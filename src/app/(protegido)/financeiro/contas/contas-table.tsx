"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Undo2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { statusLancamentoLabels } from "@/lib/labels";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { estilosNaturezaFinanceira, naturezaFinanceiraDoTipo } from "@/lib/financeiro/natureza-financeira";
import { baixarLancamentoAction, estornarBaixaLancamentoAction } from "@/app/(protegido)/financeiro/contas/actions";
import type { ContaBancariaOption, LancamentoContaRow } from "@/app/(protegido)/financeiro/types";
import type { StatusLancamento } from "@/generated/prisma/client";

type Filtro = "PAGAR" | "RECEBER" | "TUDO";

const statusBadgeVariant: Record<StatusLancamento, "success" | "warning" | "muted"> = {
  BAIXADO: "success",
  PENDENTE: "warning",
  CANCELADO: "muted",
};

function hojeIso(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

export function ContasTable({
  linhas,
  contasBancarias,
  kpis,
}: {
  linhas: LancamentoContaRow[];
  contasBancarias: ContaBancariaOption[];
  kpis: { vencidoNaoBaixado: number; venceEm7Dias: number; totalAPagar: number; totalAReceber: number };
}) {
  const [filtro, setFiltro] = useState<Filtro>("PAGAR");
  const [mostrarBaixadas, setMostrarBaixadas] = useState(false);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [estornandoId, setEstornandoId] = useState<string | null>(null);
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [dataPagamento, setDataPagamento] = useState(hojeIso());
  const [pending, startTransition] = useTransition();
  const lancamentoBaixando = linhas.find((linha) => linha.id === baixandoId);
  const estiloBaixa = lancamentoBaixando ? estilosNaturezaFinanceira[naturezaFinanceiraDoTipo(lancamentoBaixando.tipo)] : null;

  const contagemTipo = (tipo?: LancamentoContaRow["tipo"]) => linhas.filter(l => (mostrarBaixadas || l.status !== "BAIXADO") && (!tipo || l.tipo === tipo)).length.toLocaleString("pt-BR");
  const contagemBaixadas = linhas.filter(l => l.status === "BAIXADO" && (filtro === "TUDO" || l.tipo === (filtro === "PAGAR" ? "DESPESA" : "RECEITA"))).length;
  const filtradas = useMemo(() => {
    return linhas.filter((l) => {
      if (!mostrarBaixadas && l.status === "BAIXADO") return false;
      if (filtro === "PAGAR") return l.tipo === "DESPESA";
      if (filtro === "RECEBER") return l.tipo === "RECEITA";
      return true;
    });
  }, [linhas, filtro, mostrarBaixadas]);

  function abrirBaixa(id: string) {
    setBaixandoId(id);
    setContaBancariaId(contasBancarias[0]?.id ?? "");
    setDataPagamento(hojeIso());
  }

  function confirmarBaixa() {
    if (!baixandoId) return;
    startTransition(async () => {
      const resultado = await baixarLancamentoAction(baixandoId, contaBancariaId, dataPagamento);
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Baixa registrada.");
      setBaixandoId(null);
    });
  }

  function confirmarEstorno() {
    if (!estornandoId) return;
    startTransition(async () => {
      const resultado = await estornarBaixaLancamentoAction(estornandoId);
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Baixa cancelada — lançamento voltou a ficar pendente.");
      setEstornandoId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className={estilosNaturezaFinanceira.SAIDA.borda}>
          <CardContent className="space-y-1 py-4">
            <p className="text-xs text-muted-foreground uppercase">Vencido e não baixado</p>
            <p className="font-heading text-xl text-destructive">{formatarMoeda(kpis.vencidoNaoBaixado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-4">
            <p className="text-xs text-muted-foreground uppercase">Vence em 7 dias</p>
            <p className="font-heading text-xl">{formatarMoeda(kpis.venceEm7Dias)}</p>
          </CardContent>
        </Card>
        <Card className={estilosNaturezaFinanceira.SAIDA.borda}>
          <CardContent className="space-y-1 py-4">
            <p className="text-xs text-muted-foreground uppercase">Total a Pagar</p>
            <p className={`font-heading text-xl ${estilosNaturezaFinanceira.SAIDA.texto}`}>{formatarMoeda(kpis.totalAPagar)}</p>
          </CardContent>
        </Card>
        <Card className={estilosNaturezaFinanceira.ENTRADA.borda}>
          <CardContent className="space-y-1 py-4">
            <p className="text-xs text-muted-foreground uppercase">A Receber</p>
            <p className={`font-heading text-xl ${estilosNaturezaFinanceira.ENTRADA.texto}`}>{formatarMoeda(kpis.totalAReceber)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-0">
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant={filtro === "PAGAR" ? "saida" : "saida-outline"} aria-pressed={filtro === "PAGAR"} onClick={() => setFiltro("PAGAR")}>
                A pagar ({contagemTipo("DESPESA")})
              </Button>
              <Button type="button" size="sm" variant={filtro === "RECEBER" ? "entrada" : "entrada-outline"} aria-pressed={filtro === "RECEBER"} onClick={() => setFiltro("RECEBER")}>
                A receber ({contagemTipo("RECEITA")})
              </Button>
              <Button type="button" size="sm" variant={filtro === "TUDO" ? "default" : "outline"} aria-pressed={filtro === "TUDO"} onClick={() => setFiltro("TUDO")}>
                Tudo ({contagemTipo()})
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={mostrarBaixadas} onCheckedChange={(checked) => setMostrarBaixadas(checked === true)} />
              Mostrar baixadas ({contagemBaixadas.toLocaleString("pt-BR")})
            </label>
          </div>

          {filtradas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Wallet className="size-8 text-muted-foreground" />
              <p className="font-medium">Nada em aberto no filtro escolhido.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.descricao}</div>
                      <div className="text-xs text-muted-foreground">{l.fornecedorNome ?? l.contraparteNome ?? "—"}</div>
                    </TableCell>
                    <TableCell>{l.categoriaNome}</TableCell>
                    <TableCell>
                      {new Date(l.dataVencimento).toLocaleDateString("pt-BR")}
                      {l.status === "PENDENTE" && l.diasParaVencer < 0 && (
                        <span className="ml-1.5 text-xs text-destructive">vencido</span>
                      )}
                    </TableCell>
                    <TableCell className={`font-medium tabular-nums ${estilosNaturezaFinanceira[naturezaFinanceiraDoTipo(l.tipo)].texto}`}>{formatarMoeda(l.valor)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[l.status]}>{statusLancamentoLabels[l.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {l.status === "PENDENTE" && (
                        <Button type="button" size="sm" variant={estilosNaturezaFinanceira[naturezaFinanceiraDoTipo(l.tipo)].varianteBotaoContorno} onClick={() => abrirBaixa(l.id)}>
                          Baixar
                        </Button>
                      )}
                      {l.status === "BAIXADO" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setEstornandoId(l.id)}
                          aria-label="Cancelar baixa"
                          title="Cancelar baixa pra poder editar ou excluir"
                        >
                          <Undo2 className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={baixandoId !== null} onOpenChange={(next) => !next && setBaixandoId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Baixar lançamento</DialogTitle>
            <DialogDescription>Registra o pagamento/recebimento e lança a movimentação na conta escolhida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Conta Bancária</Label>
              <Select value={contaBancariaId} onValueChange={(value) => setContaBancariaId(value ?? "")} disabled={pending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha">{() => contasBancarias.find((c) => c.id === contaBancariaId)?.nome ?? "Escolha"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data do pagamento</Label>
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} disabled={pending} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
            <Button type="button" variant={estiloBaixa?.varianteBotao ?? "default"} disabled={pending || !contaBancariaId} onClick={confirmarBaixa}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Confirmar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={estornandoId !== null} onOpenChange={(next) => !next && setEstornandoId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar a baixa deste lançamento?</DialogTitle>
            <DialogDescription>
              A movimentação bancária gerada por essa baixa é apagada e o lançamento volta a ficar pendente — aí sim dá pra
              editá-lo ou excluí-lo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Voltar</DialogClose>
            <Button type="button" disabled={pending} onClick={confirmarEstorno}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Cancelar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
