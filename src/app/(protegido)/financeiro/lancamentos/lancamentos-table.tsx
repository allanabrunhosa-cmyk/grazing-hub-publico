"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Receipt, Trash2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CampoBusca } from "@/components/campo-busca";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { statusLancamentoLabels, tipoLancamentoLabels } from "@/lib/labels";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { ExcluirLancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/excluir-lancamento-dialog";
import { estornarBaixaLancamentoAction } from "@/app/(protegido)/financeiro/contas/actions";
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";
import type {
  CategoriaOption,
  ContaBancariaOption,
  FormaPagamentoOption,
  FornecedorOption,
  LancamentoRow,
} from "@/app/(protegido)/financeiro/types";
import type { StatusLancamento } from "@/generated/prisma/client";

type Coluna = "descricao" | "categoria" | "vencimento" | "valor";

const statusBadgeVariant: Record<StatusLancamento, "success" | "warning" | "muted"> = {
  BAIXADO: "success",
  PENDENTE: "warning",
  CANCELADO: "muted",
};

function normalizar(valor: string) {
  const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
  return valor.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

export function LancamentosTable({
  linhas,
  categorias,
  fornecedores,
  formasPagamento,
  contasBancarias,
}: {
  linhas: LancamentoRow[];
  categorias: CategoriaOption[];
  fornecedores: FornecedorOption[];
  formasPagamento: FormaPagamentoOption[];
  contasBancarias: ContaBancariaOption[];
}) {
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: "asc" | "desc" } | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [estornandoId, setEstornandoId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function alternarOrdenacao(coluna: Coluna) {
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna, direcao: "desc" };
      return null;
    });
  }

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    let resultado = !termo
      ? linhas
      : linhas.filter((l) => normalizar(l.descricao).includes(termo) || normalizar(l.categoriaNome).includes(termo));

    if (ordenacao) {
      const sinal = ordenacao.direcao === "asc" ? 1 : -1;
      resultado = [...resultado].sort((a, b) => {
        switch (ordenacao.coluna) {
          case "descricao":
            return sinal * a.descricao.localeCompare(b.descricao, "pt-BR");
          case "categoria":
            return sinal * a.categoriaNome.localeCompare(b.categoriaNome, "pt-BR");
          case "vencimento":
            return sinal * (new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
          case "valor":
            return sinal * (a.valor - b.valor);
        }
      });
    }
    return resultado;
  }, [linhas, busca, ordenacao]);

  function handleEstornar() {
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

  if (linhas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Receipt className="size-8 text-muted-foreground" />
          <p className="font-medium">Nenhum lançamento ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-0">
        <div className="p-4 pb-0">
          <CampoBusca value={busca} onChange={setBusca} placeholder="Buscar por descrição ou categoria..." className="max-w-sm" />
        </div>
        <Table identificationColumn={1}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Tipo</TableHead>
              <SortableTableHead active={ordenacao?.coluna === "descricao"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("descricao")}>
                Descrição
              </SortableTableHead>
              <SortableTableHead active={ordenacao?.coluna === "categoria"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("categoria")}>
                Categoria
              </SortableTableHead>
              <SortableTableHead active={ordenacao?.coluna === "vencimento"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("vencimento")}>
                Vencimento
              </SortableTableHead>
              <SortableTableHead active={ordenacao?.coluna === "valor"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("valor")}>
                Valor
              </SortableTableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <Badge variant={l.tipo === "RECEITA" ? "success" : "destructive"}>{tipoLancamentoLabels[l.tipo]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{l.descricao}</div>
                  <div className="text-xs text-muted-foreground">{l.fornecedorNome ?? l.contraparteNome ?? "—"}</div>
                </TableCell>
                <TableCell>{l.categoriaNome}</TableCell>
                <TableCell>{new Date(l.dataVencimento).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className={l.tipo === "RECEITA" ? "font-medium tabular-nums text-success" : "font-medium tabular-nums text-destructive"}>{formatarMoeda(l.valor)}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant[l.status]}>{statusLancamentoLabels[l.status]}</Badge>
                </TableCell>
                <TableCell>
                  {l.status === "PENDENTE" && (
                    <div className="flex items-center gap-1">
                      <LancamentoDialog
                        categorias={categorias}
                        fornecedores={fornecedores}
                        formasPagamento={formasPagamento}
                        contasBancarias={contasBancarias}
                        lancamento={l}
                        trigger={
                          <Button type="button" aria-label="Editar" variant="editar" />
                        }
                      />
                      <Button
                        type="button"
                        variant="excluir"
                        onClick={() => setExcluindoId(l.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
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
      </CardContent>

      {excluindoId && <ExcluirLancamentoDialog key={excluindoId} lancamentoId={excluindoId} aoFechar={() => setExcluindoId(null)} />}

      <Dialog open={estornandoId !== null} onOpenChange={(next) => !next && setEstornandoId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar a baixa deste lançamento?</DialogTitle>
            <DialogDescription>
              A movimentação bancária gerada por essa baixa é apagada e o lançamento volta a ficar pendente — aí sim você
              pode editá-lo ou excluí-lo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Voltar</DialogClose>
            <Button type="button" disabled={pending} onClick={handleEstornar}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Cancelar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
