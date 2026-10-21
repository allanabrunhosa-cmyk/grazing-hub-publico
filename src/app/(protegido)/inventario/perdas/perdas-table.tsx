"use client";
import { formatarQuantidadeEstoque } from "@/lib/estoque/quantidade";

import { useMemo, useState, type ReactNode } from "react";
import { History, ShieldCheck, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { filtrarPeriodoPerdas, dataDaPerda } from "@/lib/estoque/resumo-perdas";
import { ResumoPerdas } from "./resumo-perdas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motivoPerdaLabels, unidadeMedidaAbreviada } from "@/lib/labels";
import type { PerdaExcluidaRow, PerdaRow } from "@/app/(protegido)/inventario/types";
import { ExcluirPerdaDialog } from "./excluir-perda-dialog";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";

type Coluna = "data" | "insumo" | "motivo" | "quantidade" | "valor";
const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quantidade = formatarQuantidadeEstoque;
const motivoDaPerda = (perda: PerdaRow) => perda.motivo === "OUTRO" && perda.motivoPersonalizado ? perda.motivoPersonalizado : perda.categoriaNome ?? motivoPerdaLabels[perda.motivo];

function Motivo({ perda }: { perda: PerdaRow }) {
  return <div className="space-y-1">
    <Badge variant="destructive">{perda.categoriaNome ?? motivoPerdaLabels[perda.motivo]}</Badge>
    {perda.motivo === "OUTRO" && perda.motivoPersonalizado && perda.motivoPersonalizado !== perda.categoriaNome && <p className="break-words text-sm">{perda.motivoPersonalizado}</p>}
  </div>;
}

function Vazio({ historico = false }: { historico?: boolean }) {
  return <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center">
    {historico ? <History className="size-8 text-muted-foreground" /> : <TriangleAlert className="size-8 text-muted-foreground" />}
    <p className="font-medium">{historico ? "Nenhuma exclusão de perda registrada." : "Nenhuma perda registrada ainda."}</p>
  </CardContent></Card>;
}

function HistoricoExclusoes({ linhas }: { linhas: PerdaExcluidaRow[] }) {
  return <div className="space-y-3">
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />Histórico visível apenas aos administradores.</p>
    {linhas.length === 0 ? <Vazio historico /> : linhas.map((perda) => <Card key={perda.id}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><IdentificacaoInsumo nome={perda.insumoNome} especificacao={perda.insumoEspecificacao} nomeClassName="font-semibold" /><p className="break-words text-xs text-muted-foreground">Perda em {new Date(perda.data).toLocaleDateString("pt-BR")} · {perda.localNome}</p></div>
          <Badge variant="secondary">Excluída</Badge>
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">Motivo da perda</dt><dd className="mt-1 break-words">{motivoDaPerda(perda)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Quantidade e valor da perda</dt><dd className="mt-1">{quantidade(perda.quantidade)} {unidadeMedidaAbreviada[perda.unidade]} · {moeda(perda.valorEstimado)}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">Documentada por</dt><dd className="mt-1 break-words">{perda.responsavelNome || "Não informado no registro antigo"}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">Excluída por</dt><dd className="mt-1 break-words">{perda.responsavelExclusaoNome}<span className="mt-0.5 block text-xs text-muted-foreground">{new Date(perda.excluidaEm).toLocaleString("pt-BR")}</span></dd></div>
        </dl>
        {perda.observacao && <p className="break-words text-sm"><span className="text-muted-foreground">Observação da perda: </span>{perda.observacao}</p>}
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <p className="break-words text-sm"><span className="font-medium">Motivo da exclusão: </span>{perda.motivoExclusao}</p>
          <p className="flex items-center gap-2 text-sm"><Undo2 className="size-4 shrink-0" />{quantidade(perda.quantidadeEstornada)} {unidadeMedidaAbreviada[perda.unidadeEstornada]} devolvidos ao estoque.</p>
        </div>
      </CardContent>
    </Card>)}
  </div>;
}

export function PerdasTable({ linhas, responsavelNome, historico, acaoRegistrar }: { linhas: PerdaRow[]; responsavelNome?: string; historico?: PerdaExcluidaRow[]; acaoRegistrar?: ReactNode }) {
  const [periodo, definirPeriodo] = useState(periodoMesAteHoje);
  const filtradas = useMemo(() => filtrarPeriodoPerdas(linhas, periodo.de, periodo.ate, perda => perda.data), [linhas, periodo]);
  const exclusoesFiltradas = useMemo(() => historico === undefined ? undefined : filtrarPeriodoPerdas(historico, periodo.de, periodo.ate, perda => perda.excluidaEm), [historico, periodo]);
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: "asc" | "desc" } | null>(null);
  const [perdaParaExcluir, definirPerdaParaExcluir] = useState<PerdaRow | null>(null);
  function alternarOrdenacao(coluna: Coluna) {
    setOrdenacao((atual) => atual?.coluna !== coluna ? { coluna, direcao: "asc" } : atual.direcao === "asc" ? { coluna, direcao: "desc" } : null);
  }
  const ordenadas = useMemo(() => {
    if (!ordenacao) return filtradas;
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      switch (ordenacao.coluna) {
        case "data": return sinal * (new Date(a.data).getTime() - new Date(b.data).getTime());
        case "insumo": return sinal * a.insumoNome.localeCompare(b.insumoNome, "pt-BR");
        case "motivo": return sinal * motivoDaPerda(a).localeCompare(motivoDaPerda(b), "pt-BR");
        case "quantidade": return sinal * (a.quantidade - b.quantidade);
        case "valor": return sinal * (a.valorEstimado - b.valorEstimado);
      }
    });
  }, [filtradas, ordenacao]);
  function botaoExcluir(perda: PerdaRow) {
    return <Button variant="excluir" aria-label={`Excluir perda de ${perda.insumoNome}`} onClick={() => definirPerdaParaExcluir(perda)}><Trash2 className="size-4" /></Button>;
  }
  function cabecalho(titulo: string, coluna: Coluna) {
    return <button type="button" className="text-left text-xs font-medium hover:text-foreground" onClick={() => alternarOrdenacao(coluna)}>{titulo}{ordenacao?.coluna === coluna ? (ordenacao.direcao === "asc" ? " ↑" : " ↓") : " ↕"}</button>;
  }
  const lista = filtradas.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma perda no período selecionado.</CardContent></Card> : <div className="min-w-0 rounded-xl border bg-card">
    <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-5 border-b bg-muted/40 px-5 py-3 text-muted-foreground xl:grid">
      <div className="flex flex-wrap gap-x-3 gap-y-1">{cabecalho("Insumo / Local", "insumo")}{cabecalho("Data", "data")}</div>
      {cabecalho("Motivo", "motivo")}
      <div className="flex flex-wrap gap-x-3 gap-y-1">{cabecalho("Valor", "valor")}{cabecalho("Quantidade", "quantidade")}</div>
      <span className="text-xs font-medium">Documentada por</span>
    </div>
    <ul className="divide-y">{ordenadas.map(perda => <li key={perda.id} className="grid min-w-0 gap-4 p-5 text-sm sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] xl:gap-5 [&>div]:min-w-0 [&>div]:[overflow-wrap:anywhere]">
      <div><IdentificacaoInsumo nome={perda.insumoNome} especificacao={perda.insumoEspecificacao} nomeClassName="font-semibold" /><p className="mt-1 text-xs text-muted-foreground">{perda.localNome}</p><p className="mt-1 text-xs text-muted-foreground">{dataDaPerda(perda.data).split("-").reverse().join("/")}</p>{perda.observacao && <p className="mt-2 text-xs text-muted-foreground">{perda.observacao}</p>}</div>
      <div><p className="mb-1 text-xs text-muted-foreground xl:hidden">Motivo</p><Motivo perda={perda} /></div>
      <div><p className="mb-1 text-xs text-muted-foreground xl:hidden">Valor pelo custo médio e quantidade</p><p className="font-semibold tabular-nums">{moeda(perda.valorEstimado)}</p><p className="mt-1 text-xs text-muted-foreground">{quantidade(perda.quantidade)} {unidadeMedidaAbreviada[perda.unidade]}</p></div>
      <div><p className="mb-1 text-xs text-muted-foreground xl:hidden">Documentada por</p><p>{perda.responsavelNome || "Não informado no registro antigo"}</p><div className="mt-2">{botaoExcluir(perda)}</div></div>
    </li>)}</ul>
  </div>;
  return <div className="min-w-0 space-y-4">
    <div className="min-w-0 space-y-2 rounded-xl border bg-card p-4">
      <FiltroPeriodo de={periodo.de} ate={periodo.ate} aoAlterar={definirPeriodo} />
      <p className="text-xs text-muted-foreground">{periodo.de || periodo.ate ? "Resumo e perdas pela data do registro, no período selecionado." : "Todo o histórico de perdas. Selecione as datas para consultar um período."}</p>
    </div>
    <ResumoPerdas linhas={filtradas} referenciaCores={linhas} />
    <Tabs defaultValue="perdas" className="min-w-0 gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <TabsList aria-label="Registros de perdas" className="max-w-full overflow-y-hidden"><TabsTrigger value="perdas" className="px-2 text-xs sm:px-3 sm:text-sm">Perdas ({filtradas.length})</TabsTrigger>{exclusoesFiltradas !== undefined && <TabsTrigger value="exclusoes" className="px-2 text-xs sm:px-3 sm:text-sm"><History className="hidden size-4 sm:block" />Exclusões ({exclusoesFiltradas.length})</TabsTrigger>}</TabsList>
        {acaoRegistrar}
      </div>
      <TabsContent value="perdas" className="min-w-0">{lista}</TabsContent>
      {exclusoesFiltradas !== undefined && <TabsContent value="exclusoes" className="min-w-0 space-y-3"><p className="text-xs text-muted-foreground">Filtro aplicado à data da exclusão. Estes registros não entram no resumo de perdas.</p><HistoricoExclusoes linhas={exclusoesFiltradas} /></TabsContent>}
    </Tabs>
    {perdaParaExcluir && <ExcluirPerdaDialog perda={perdaParaExcluir} responsavelNome={responsavelNome || "Usuário conectado"} aoFechar={() => definirPerdaParaExcluir(null)} aoExcluir={() => definirPerdaParaExcluir(null)} />}
  </div>;
}
