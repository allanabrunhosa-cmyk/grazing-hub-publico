"use client";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { formatarQuantidadeEstoque } from "@/lib/estoque/quantidade";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, History, PackagePlus } from "lucide-react";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { CampoBusca } from "@/components/campo-busca";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { TIPOS_ENTRADA, dataMovimentacao, movimentacaoNoPeriodo } from "@/lib/estoque/extrato";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tipoMovimentacaoEstoqueLabels, unidadeMedidaAbreviada } from "@/lib/labels";
import type { MovimentacaoRow } from "@/app/(protegido)/inventario/types";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";

function normalizar(valor: string) {
  const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
  return valor.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

const formatarQuantidade = formatarQuantidadeEstoque;

const FILTROS: { valor: "TODAS" | "ENTRADAS" | "SAIDAS"; label: string }[] = [
  { valor: "TODAS", label: "Todas" },
  { valor: "ENTRADAS", label: "Entradas" },
  { valor: "SAIDAS", label: "Saídas" },
];

const correspondeTipo = (tipo: MovimentacaoRow["tipo"], filtro: "TODAS" | "ENTRADAS" | "SAIDAS") =>
  filtro === "TODAS" || (filtro === "ENTRADAS") === TIPOS_ENTRADA.includes(tipo);

export function MovimentacoesTable({ linhas }: { linhas: MovimentacaoRow[] }) {
  const { pode } = useAcesso();
  const [query, setQuery] = useState("");
  const [periodo, definirPeriodo] = useState(periodoMesAteHoje);
  const [filtro, setFiltro] = useState<"TODAS" | "ENTRADAS" | "SAIDAS">("TODAS");
  const [ordenacao, setOrdenacao] = useState<{ coluna: "data" | "insumo" | "tipo" | "quantidade" | "saldo"; direcao: "asc" | "desc" } | null>(null);

  function alternarOrdenacao(coluna: "data" | "insumo" | "tipo" | "quantidade" | "saldo") {
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna, direcao: "desc" };
      return null;
    });
  }

  const porBuscaEPeriodo = useMemo(() => {
    const termo = normalizar(query.trim());
    const resultado = linhas.filter((linha) => {
      if (!movimentacaoNoPeriodo(linha.createdAt, periodo.de, periodo.ate)) return false;
      if (!termo) return true;
      return normalizar(`${linha.insumoNome} ${linha.insumoEspecificacao ?? ""}`).includes(termo);
    });

    return resultado;
  }, [linhas, query, periodo]);
  const filtradas = useMemo(() => {
    const resultado = porBuscaEPeriodo.filter(linha => correspondeTipo(linha.tipo, filtro));
    if (!ordenacao) return resultado;
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...resultado].sort((a, b) => {
      switch (ordenacao.coluna) {
        case "data":
          return sinal * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case "insumo":
          return sinal * a.insumoNome.localeCompare(b.insumoNome, "pt-BR");
        case "tipo":
          return sinal * tipoMovimentacaoEstoqueLabels[a.tipo].localeCompare(tipoMovimentacaoEstoqueLabels[b.tipo], "pt-BR");
        case "quantidade":
          return sinal * (a.quantidade - b.quantidade);
        case "saldo":
          if (a.saldo === null) return b.saldo === null ? 0 : 1;
          if (b.saldo === null) return -1;
          return sinal * (a.saldo - b.saldo);
      }
    });
     
  }, [porBuscaEPeriodo, filtro, ordenacao]);

  return (
    <Card className="gap-4 py-4">
      <div className="flex flex-wrap items-center gap-2 px-4">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} aoAlterar={definirPeriodo} />
        <CampoBusca aria-label="Buscar insumo" value={query} onChange={setQuery} placeholder="Buscar insumo..." className="h-9!" />
        <FiltroOpcoesContadas nome="Tipo das movimentações de estoque" valor={filtro} onValueChange={setFiltro}
          opcoes={FILTROS.map(opcao => ({ valor: opcao.valor, nome: opcao.label,
            quantidade: porBuscaEPeriodo.filter(linha => correspondeTipo(linha.tipo, opcao.valor)).length }))} />
        <GrupoAcoes nome="Entradas avulsas" className="ml-auto">
        {pode("inventario.entrada", "adicionar") && (
          <Button size="sm" nativeButton={false} role="link" render={<Link href="/inventario/entrada-avulsa" />}>
            <PackagePlus aria-hidden="true" />
            Entrada avulsa
          </Button>
        )}
        {pode("inventario", "visualizar") && <Button size="icon-sm" variant="outline" nativeButton={false} role="link" aria-label="Histórico de entradas avulsas" title="Histórico de entradas avulsas" render={<Link href="/inventario/entradas" />}><History /></Button>}
        </GrupoAcoes>
      </div>
      <p className="px-4 text-xs text-muted-foreground">Saldo do insumo no local após cada movimentação, considerando o histórico completo.</p>

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <ArrowLeftRight className="size-8 text-muted-foreground" />
          <p className="font-medium">Nenhuma movimentação encontrada.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block"><Table identificationColumn={1} className="table-fixed">
              <TableHeader>
                <TableRow>
                  <SortableTableHead className="w-[11%]" active={ordenacao?.coluna === "data"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("data")}>
                    Data
                  </SortableTableHead>
                  <SortableTableHead
                    className="w-[32%]"
                    active={ordenacao?.coluna === "insumo"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("insumo")}
                  >
                    Insumo
                  </SortableTableHead>
                  <TableHead className="hidden w-[14%] sm:table-cell">Local</TableHead>
                  <SortableTableHead className="w-[17%]" active={ordenacao?.coluna === "tipo"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("tipo")}>
                    Tipo
                  </SortableTableHead>
                  <SortableTableHead
                    className="w-[13%]"
                    active={ordenacao?.coluna === "quantidade"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("quantidade")}
                  >
                    Quantidade
                  </SortableTableHead>
                  <SortableTableHead className="w-[13%]" active={ordenacao?.coluna === "saldo"} direction={ordenacao?.direcao} onClick={() => alternarOrdenacao("saldo")}>Saldo</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((linha) => {
                  const ehEntrada = TIPOS_ENTRADA.includes(linha.tipo);
                  return (
                    <TableRow key={linha.id}>
                      <TableCell>{dataMovimentacao(linha.createdAt).split("-").reverse().join("/")}</TableCell>
                      <TableCell className="whitespace-normal [overflow-wrap:anywhere]">
                        <IdentificacaoInsumo nome={linha.insumoNome} especificacao={linha.insumoEspecificacao} nomeClassName="font-medium" />
                        {linha.observacao && <div className="text-xs text-muted-foreground">{linha.observacao}</div>}
                      </TableCell>
                      <TableCell className="hidden whitespace-normal sm:table-cell [overflow-wrap:anywhere]">{linha.localNome}</TableCell>
                      <TableCell>
                        <Badge className="h-auto whitespace-normal" variant={ehEntrada ? "success" : "destructive"}>{tipoMovimentacaoEstoqueLabels[linha.tipo]}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {ehEntrada ? "+" : "-"}
                        {formatarQuantidade(linha.quantidade)} {unidadeMedidaAbreviada[linha.unidade]}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {linha.saldo === null ? <span title="Posição de estoque indisponível">—</span> : <>{formatarQuantidade(linha.saldo)} {unidadeMedidaAbreviada[linha.unidade]}</>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></div>
          <ul className="divide-y border-t md:hidden">{filtradas.map(linha => <li key={linha.id} className="space-y-3 px-4 py-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{dataMovimentacao(linha.createdAt).split("-").reverse().join("/")}</span><Badge variant={TIPOS_ENTRADA.includes(linha.tipo) ? "success" : "destructive"}>{tipoMovimentacaoEstoqueLabels[linha.tipo]}</Badge></div>
            <div className="[overflow-wrap:anywhere]"><IdentificacaoInsumo nome={linha.insumoNome} especificacao={linha.insumoEspecificacao} nomeClassName="font-medium" /><p className="text-xs text-muted-foreground">{linha.localNome}</p>{linha.observacao && <p className="mt-1 text-xs text-muted-foreground">{linha.observacao}</p>}</div>
            <dl className="grid grid-cols-2 gap-3 tabular-nums"><div><dt className="text-xs text-muted-foreground">Quantidade</dt><dd>{TIPOS_ENTRADA.includes(linha.tipo) ? "+" : "-"}{formatarQuantidade(linha.quantidade)} {unidadeMedidaAbreviada[linha.unidade]}</dd></div><div><dt className="text-xs text-muted-foreground">Saldo</dt><dd className="font-semibold">{linha.saldo === null ? "Indisponível" : `${formatarQuantidade(linha.saldo)} ${unidadeMedidaAbreviada[linha.unidade]}`}</dd></div></dl>
          </li>)}</ul>
        </>
      )}
    </Card>
  );
}
