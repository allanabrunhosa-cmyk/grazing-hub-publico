"use client";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ArrowRight, Trash2 } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusContagemLabels } from "@/lib/labels";
import type { ContagemListRow } from "@/app/(protegido)/inventario/types";
import type { StatusContagem } from "@/generated/prisma/client";
import { ExcluirContagemDialog } from "./excluir-contagem-dialog";

type Coluna = "local" | "data" | "status";

const statusContagemBadgeVariant: Record<StatusContagem, "success" | "warning" | "muted"> = {
  FINALIZADO: "success",
  EM_ANDAMENTO: "warning",
  EXCLUIDO: "muted",
};

export function ContagemTable({ linhas, administrador = false }: { linhas: ContagemListRow[]; administrador?: boolean }) {
  const router = useRouter();
  const [mostrarExcluidas, setMostrarExcluidas] = useState(false);
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: "asc" | "desc" } | null>(null);
  const [contagemExcluindo, setContagemExcluindo] = useState<ContagemListRow | null>(null);
  function alternarOrdenacao(coluna: Coluna) {
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna, direcao: "desc" };
      return null;
    });
  }

  const ordenadas = useMemo(() => {
    const filtradas = linhas.filter(contagem => (contagem.status === "EXCLUIDO") === mostrarExcluidas);
    if (!ordenacao) return filtradas;
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      switch (ordenacao.coluna) {
        case "local":
          return sinal * a.localNome.localeCompare(b.localNome, "pt-BR");
        case "data":
          return sinal * (new Date(a.dataContagem).getTime() - new Date(b.dataContagem).getTime());
        case "status":
          return sinal * statusContagemLabels[a.status].localeCompare(statusContagemLabels[b.status], "pt-BR");
      }
    });
  }, [linhas, ordenacao, mostrarExcluidas]);

  return (
    <Card>
      <FiltroOpcoesContadas nome="Filtrar contagens" className="px-4" valor={mostrarExcluidas ? "EXCLUIDAS" : "CONTAGENS"}
        onValueChange={valor => setMostrarExcluidas(valor === "EXCLUIDAS")} opcoes={[
          { valor: "CONTAGENS", nome: "Contagens", quantidade: linhas.filter(linha => linha.status !== "EXCLUIDO").length },
          { valor: "EXCLUIDAS", nome: "Excluídas", quantidade: linhas.filter(linha => linha.status === "EXCLUIDO").length },
        ]} />
      <CardContent className="p-0">
        {ordenadas.length === 0 ? <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="font-medium">{mostrarExcluidas ? "Nenhuma contagem excluída." : "Nenhuma contagem disponível."}</p>
        </div> : <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead active={ordenacao?.coluna === "local"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("local")}>
                Local
              </SortableTableHead>
              <SortableTableHead active={ordenacao?.coluna === "data"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("data")}>
                Data
              </SortableTableHead>
              <SortableTableHead
                active={ordenacao?.coluna === "status"}
                direction={ordenacao?.direcao}
                onClick={() => alternarOrdenacao("status")}
              >
                Status
              </SortableTableHead>
              <TableHead className="hidden sm:table-cell">Progresso</TableHead>
              <TableHead className="hidden md:table-cell">Responsável</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenadas.map((contagem) => (
              <TableRow key={contagem.id} className="cursor-pointer hover:bg-muted/50" onClick={(evento) => {
                if ((evento.target as HTMLElement).closest("a, button")) return;
                router.push(`/inventario/contagem/${contagem.id}`);
              }}>
                <TableCell className="p-0">
                  <Link href={`/inventario/contagem/${contagem.id}`} className="block px-4 py-3 font-medium">
                    {contagem.localNome}
                  </Link>
                </TableCell>
                <TableCell>{new Date(contagem.dataContagem).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Badge variant={statusContagemBadgeVariant[contagem.status]}>
                    {statusContagemLabels[contagem.status]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {contagem.itensContados} de {contagem.totalItens} contados
                  {contagem.status === "FINALIZADO" && <div className="text-xs text-muted-foreground">{contagem.itensAjustados} ajustado(s)</div>}
                </TableCell>
                <TableCell className="hidden md:table-cell">{contagem.responsavelNome ?? "—"}</TableCell>
                <TableCell onClick={(evento) => evento.stopPropagation()}>
                  <GrupoAcoes className="justify-end">
                    <Link href={`/inventario/contagem/${contagem.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      {contagem.status === "EM_ANDAMENTO" ? "Continuar contagem" : "Ver contagem"}
                      <ArrowRight className="size-3.5" />
                    </Link>
                    {(contagem.status === "EM_ANDAMENTO" || (administrador && contagem.status === "FINALIZADO")) && <Button type="button" variant="excluir" aria-label={`Excluir contagem de ${contagem.localNome}`} onClick={() => setContagemExcluindo(contagem)}>
                      <Trash2 className="size-4" />
                    </Button>}
                  </GrupoAcoes>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>}
      </CardContent>
      {contagemExcluindo && <ExcluirContagemDialog key={contagemExcluindo.id} contagem={contagemExcluindo} aoFechar={() => setContagemExcluindo(null)} aoExcluir={() => router.refresh()} />}
    </Card>
  );
}
