"use client";
import { formatarQuantidadeEstoque } from "@/lib/estoque/quantidade";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes, MoreVertical, PackagePlus, TriangleAlert, History, ChevronRight, Loader2 } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PerdaDialog } from "@/app/(protegido)/inventario/perdas/perda-dialog";
import { obterMovimentacoesInsumoAction } from "@/app/(protegido)/inventario/historico-insumo-actions";
import { TIPOS_ENTRADA } from "@/lib/estoque/extrato";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { tipoMovimentacaoEstoqueLabels, unidadeMedidaAbreviada, unidadeMedidaLabels } from "@/lib/labels";
import type { CategoriaPerdaOption, HistoricoInsumoDetalhe, LocalOption, PosicaoAtualRow } from "@/app/(protegido)/inventario/types";
import { cn } from "cn";
import { marcasDoInsumo } from "@/lib/insumos/marcas";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { IconeInsumo, IconePreparacao } from "@/components/icones-insumos";
import { TipoProdutoGlobal } from "@/generated/prisma/browser";

function normalizar(valor: string) {
  const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
  return valor.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

export function PosicaoAtualTable({
  linhas,
  locais,
  dataSelecionada,
  hoje,
  isHistorico,
  responsavelNome,
  podeCadastrarInsumo,
  categoriasPerda = [],
}: {
  linhas: PosicaoAtualRow[];
  locais: LocalOption[];
  dataSelecionada: string;
  hoje: string;
  isHistorico: boolean;
  responsavelNome?: string;
  podeCadastrarInsumo?: boolean;
  categoriasPerda?: CategoriaPerdaOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoProdutoGlobal | "TODOS">("TODOS");
  const [localFiltro, setLocalFiltro] = useState<string>("TODOS");
  const [somenteAbaixoMinimo, setSomenteAbaixoMinimo] = useState(false);
  const [perdaAlvo, setPerdaAlvo] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<{ coluna: "insumo" | "qtd" | "minimo" | "maximo" | "custo" | "fornecedores"; direcao: "asc" | "desc" } | null>(null);

  function alternarOrdenacao(coluna: "insumo" | "qtd" | "minimo" | "maximo" | "custo" | "fornecedores") {
    setExpandidoId(null);
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna, direcao: "desc" };
      return null;
    });
  }

  const localSelecionado = locais.find((l) => l.id === localFiltro) ?? null;
  const insumosParaPerda = useMemo(
    () => linhas.map((l) => ({ id: l.insumoId, nome: l.nome, especificacao: l.especificacao, unidade: l.unidade, custoMedio: l.custoMedio })),
    [linhas]
  );
  const valorTotalEstoque = useMemo(() => linhas.reduce((totalCentavos, linha) => {
    const quantidade = localFiltro === "TODOS"
      ? Object.values(linha.saldosPorLocal).reduce((soma, valor) => soma + valor, 0)
      : (linha.saldosPorLocal[localFiltro] ?? 0);
    return totalCentavos + Math.round(quantidade * linha.custoMedio * 100);
  }, 0) / 100, [linhas, localFiltro]);
  const itensDoLocal = useCallback((local: string, abaixoMinimo = somenteAbaixoMinimo) => {
    const termo = normalizar(query.trim());
    return linhas
      .map((linha) => {
        const quantidadeAtual =
          local === "TODOS"
            ? Object.values(linha.saldosPorLocal).reduce((soma, v) => soma + v, 0)
            : (linha.saldosPorLocal[local] ?? 0);
        return { ...linha, quantidadeAtual };
      })
      .filter((linha) => (!termo || normalizar([linha.nome, linha.especificacao ?? "", ...marcasDoInsumo(linha), linha.categoriaNome ?? "", ...linha.fornecedoresHomologados.map((f) => f.nome)].join(" ")).includes(termo)) &&
        (!abaixoMinimo || linha.quantidadeAtual < linha.estoqueMinimo));
  }, [linhas, query, somenteAbaixoMinimo]);
  const porBuscaEMinimo = useMemo(() => itensDoLocal(localFiltro), [itensDoLocal, localFiltro]);
  const contagemLocal = (local: string) => itensDoLocal(local).filter(linha => filtroTipo === "TODOS" || linha.tipo === filtroTipo).length.toLocaleString("pt-BR");
  const abaixoMinimoNoFiltro = itensDoLocal(localFiltro, true).filter(linha => filtroTipo === "TODOS" || linha.tipo === filtroTipo).length;
  const filtradas = useMemo(() => {
    const resultado = porBuscaEMinimo.filter(linha => filtroTipo === "TODOS" || linha.tipo === filtroTipo);
    if (!ordenacao) return resultado;
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...resultado].sort((a, b) => {
      switch (ordenacao.coluna) {
        case "insumo":
          return sinal * a.nome.localeCompare(b.nome, "pt-BR");
        case "fornecedores":
          return sinal * a.fornecedoresHomologados.map((f) => f.nome).join(", ").localeCompare(b.fornecedoresHomologados.map((f) => f.nome).join(", "), "pt-BR");
        case "qtd":
          return sinal * (a.quantidadeAtual - b.quantidadeAtual);
        case "minimo":
          return sinal * (a.estoqueMinimo - b.estoqueMinimo);
        case "maximo":
          return sinal * (a.estoqueMaximo == null ? (b.estoqueMaximo == null ? 0 : 1) : b.estoqueMaximo == null ? -1 : a.estoqueMaximo - b.estoqueMaximo);
        case "custo":
          return sinal * (a.custoMedio - b.custoMedio);
      }
    });
     
  }, [porBuscaEMinimo, filtroTipo, ordenacao]);

  function mudarData(novaData: string) {
    if (!novaData || novaData === hoje) {
      router.push("/inventario");
    } else {
      router.push(`/inventario?data=${novaData}`);
    }
  }

  return (
    <>
    <Card className="gap-4 py-4">
      <div className="flex flex-wrap items-center gap-2 px-4">
        <CampoBusca value={query} onChange={(valor) => { setQuery(valor); setExpandidoId(null); }} placeholder="Insumo, marca, categoria ou fornecedor..." aria-label="Buscar insumo, marca, categoria ou fornecedor" />
        <FiltroOpcoesContadas nome="Filtrar estoque por tipo" valor={filtroTipo} onValueChange={valor => { setFiltroTipo(valor); setExpandidoId(null); }} opcoes={[
          { valor: "TODOS", nome: "Todos", quantidade: porBuscaEMinimo.length },
          { valor: TipoProdutoGlobal.INSUMO, nome: "Insumo", quantidade: porBuscaEMinimo.filter(linha => linha.tipo === TipoProdutoGlobal.INSUMO).length, icone: <IconeInsumo className="size-4" monocromatico={filtroTipo === TipoProdutoGlobal.INSUMO} /> },
          { valor: TipoProdutoGlobal.PRODUTO_INTERMEDIARIO, nome: "Preparações", quantidade: porBuscaEMinimo.filter(linha => linha.tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO).length, icone: <IconePreparacao className="size-4" monocromatico={filtroTipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO} /> },
        ]} />
        <Select value={localFiltro} onValueChange={(v) => { setLocalFiltro(v ?? "TODOS"); setExpandidoId(null); }}>
          <SelectTrigger className="h-9" aria-label="Local de estoque">
            <SelectValue placeholder="Todos os locais">
              {() => (localFiltro === "TODOS" ? "Todos os locais" : (localSelecionado?.nome ?? "Todos os locais")) + " (" + contagemLocal(localFiltro) + ")"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os locais ({contagemLocal("TODOS")})</SelectItem>
            {locais.map((local) => (
              <SelectItem key={local.id} value={local.id}>
                {local.nome} ({contagemLocal(local.id)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant={somenteAbaixoMinimo ? "default" : "outline"}
          aria-pressed={somenteAbaixoMinimo} onClick={() => { setSomenteAbaixoMinimo(valor => !valor); setExpandidoId(null); }}
          className="gap-1.5">
          <TriangleAlert className="size-4" /> Abaixo do mínimo
          <Badge variant={somenteAbaixoMinimo ? "secondary" : "warning"}>{abaixoMinimoNoFiltro.toLocaleString("pt-BR")}</Badge>
        </Button>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <label htmlFor="data-posicao">Ver em</label>
          <Input
            id="data-posicao"
            type="date"
            value={dataSelecionada}
            max={hoje}
            onChange={(e) => mudarData(e.target.value)}
            className="h-9 w-auto"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant={isHistorico ? "outline" : "default"}
          onClick={() => mudarData(hoje)}
        >
          Posição atual
        </Button>
        <output
          aria-label="Valor total em estoque"
          aria-live="polite"
          title={isHistorico
            ? "Quantidade na data selecionada multiplicada pelo custo médio atual de cada insumo."
            : "Quantidade atual multiplicada pelo custo médio de cada insumo."}
          className="ml-auto rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-right"
        >
          <span className="block text-[11px] leading-none text-muted-foreground">Valor total em estoque</span>
          <strong className="mt-1 block whitespace-nowrap font-heading text-sm tabular-nums text-foreground">
            {formatarMoeda(valorTotalEstoque)}
          </strong>
        </output>
      </div>

      {isHistorico && (
        <div className="flex items-center gap-1.5 px-4 text-sm text-muted-foreground">
          <History className="size-4" />
          Posição em {new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString("pt-BR")}, reconstruída a partir do
          histórico de movimentações — somente leitura.
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <Boxes className="size-8 text-muted-foreground" />
          <p className="font-medium">{linhas.length === 0 ? "Nenhum insumo cadastrado ainda." : "Nenhum insumo encontrado."}</p>
        </div>
      ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={ordenacao?.coluna === "insumo"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("insumo")}
                  >
                    Insumo
                  </SortableTableHead>
                  <SortableTableHead
                    active={ordenacao?.coluna === "qtd"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("qtd")}
                  >
                    Qtd. {isHistorico ? "na data" : "atual"}
                  </SortableTableHead>
                  <SortableTableHead
                    className="hidden sm:table-cell"
                    active={ordenacao?.coluna === "minimo"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("minimo")}
                  >
                    Mínimo
                  </SortableTableHead>
                  <SortableTableHead
                    className="hidden md:table-cell"
                    active={ordenacao?.coluna === "maximo"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("maximo")}
                  >
                    Máximo
                  </SortableTableHead>
                  <SortableTableHead
                    className="hidden lg:table-cell"
                    active={ordenacao?.coluna === "custo"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("custo")}
                  >
                    Custo médio
                  </SortableTableHead>
                  <SortableTableHead active={ordenacao?.coluna === "fornecedores"} direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("fornecedores")}>Fornecedores</SortableTableHead>
                  {!isHistorico && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((linha) => {
                  const abaixoDoMinimo = linha.quantidadeAtual < linha.estoqueMinimo;
                  const aberto = expandidoId === linha.insumoId;
                  return (
                    <Fragment key={linha.insumoId}>
                    <TableRow
                      className={cn("cursor-pointer", aberto && "border-b-0")}
                      onClick={() => setExpandidoId(aberto ? null : linha.insumoId)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-expanded={aberto}
                            aria-label={aberto ? `Fechar movimentações de ${linha.nome}` : `Abrir movimentações de ${linha.nome}`}
                            onClick={(evento) => { evento.stopPropagation(); setExpandidoId(aberto ? null : linha.insumoId); }}
                            className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <ChevronRight className={cn("size-4 transition-transform duration-200", aberto && "rotate-90")} />
                          </button>
                          <div>
                            <IdentificacaoInsumo nome={linha.nome} especificacao={linha.especificacao} nomeClassName="font-medium" />
                            <div className="text-xs text-muted-foreground">{unidadeMedidaLabels[linha.unidade]}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="whitespace-nowrap tabular-nums">
                            {linha.quantidadeAtual} {unidadeMedidaAbreviada[linha.unidade]}
                          </span>
                          {abaixoDoMinimo && <Badge variant="warning">Abaixo do mínimo</Badge>}
                        </div>
                        <div className="mt-1 whitespace-nowrap text-xs text-muted-foreground sm:hidden">
                          Mínimo: {linha.estoqueMinimo} {unidadeMedidaAbreviada[linha.unidade]}
                        </div>
                        <div className="mt-1 whitespace-nowrap text-xs text-muted-foreground md:hidden">
                          Máximo: {linha.estoqueMaximo ?? "—"} {linha.estoqueMaximo == null ? "" : unidadeMedidaAbreviada[linha.unidade]}
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">
                        {linha.estoqueMinimo} {unidadeMedidaAbreviada[linha.unidade]}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">
                        {linha.estoqueMaximo == null ? "—" : `${linha.estoqueMaximo} ${unidadeMedidaAbreviada[linha.unidade]}`}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">R$ {linha.custoMedio.toFixed(2)}</TableCell>
                      <TableCell className="min-w-[180px] whitespace-normal">
                        <span className="block max-w-[280px] break-words">
                          {linha.fornecedoresHomologados.length ? linha.fornecedoresHomologados.map((f) => f.nome).join(", ") : <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>
                      {!isHistorico && (
                        <TableCell className="text-right" onClick={(evento) => evento.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="outline" size="icon">
                                  <MoreVertical className="size-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/inventario/entrada-avulsa?insumoId=${linha.insumoId}`)}>
                                <PackagePlus className="size-4" />
                                Registrar entrada de insumo
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => setPerdaAlvo(linha.insumoId)}>
                                <TriangleAlert className="size-4" />
                                Registrar perda
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                    {aberto && (
                      <LinhaMovimentacoesInsumo
                        insumo={linha}
                        colunas={isHistorico ? 6 : 7}
                        localId={localFiltro === "TODOS" ? null : localFiltro}
                        dataReferencia={isHistorico ? dataSelecionada : null}
                        onFechar={() => setExpandidoId(null)}
                      />
                    )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
      )}
    </Card>

    <PerdaDialog
      key={perdaAlvo ?? "fechado"}
      insumos={insumosParaPerda}
      locais={locais}
      responsavelNome={responsavelNome}
      podeCadastrarInsumo={podeCadastrarInsumo}
      categorias={categoriasPerda}
      insumoIdPreselecionado={perdaAlvo}
      open={perdaAlvo != null}
      onOpenChange={(next) => {
        if (!next) setPerdaAlvo(null);
      }}
    />
    </>
  );
}

const formatarQuantidade = formatarQuantidadeEstoque;
const FORMATADOR_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});
const formatarDataHora = (valor: string) => FORMATADOR_DATA_HORA.format(new Date(valor));

function LinhaMovimentacoesInsumo({
  insumo,
  colunas,
  localId,
  dataReferencia,
  onFechar,
}: {
  insumo: PosicaoAtualRow & { quantidadeAtual: number };
  colunas: number;
  localId: string | null;
  dataReferencia: string | null;
  onFechar: () => void;
}) {
  const [dados, setDados] = useState<HistoricoInsumoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const [larguraVisivel, setLarguraVisivel] = useState<number | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    iniciarTransicao(async () => {
      const resultado = await obterMovimentacoesInsumoAction({ insumoId: insumo.insumoId, localId, dataReferencia });
      if (!ativo) return;
      if ("erro" in resultado) setErro(resultado.erro);
      else setDados(resultado.dados);
    });
    return () => { ativo = false; };
  }, [dataReferencia, insumo.insumoId, localId]);

  useEffect(() => {
    const area = painelRef.current?.closest<HTMLElement>('[data-slot="table-container"]');
    if (!area) return;
    const observer = new ResizeObserver(() => setLarguraVisivel(area.clientWidth));
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const unidade = unidadeMedidaAbreviada[dados?.unidade ?? insumo.unidade];
  const referencia = dados?.dataReferencia
    ? new Date(`${dados.dataReferencia}T12:00:00`).toLocaleDateString("pt-BR")
    : null;

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={colunas} className="p-0 whitespace-normal">
        <div style={larguraVisivel ? { width: larguraVisivel } : undefined} className="sticky left-0 w-0">
          <div
            ref={painelRef}
            tabIndex={-1}
            onKeyDown={(evento) => {
              if (evento.key === "Escape" && !evento.defaultPrevented) {
                evento.stopPropagation();
                onFechar();
              }
            }}
            className="animate-in border-l-2 border-primary p-4 outline-none fade-in slide-in-from-top-2 duration-200"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-heading font-semibold">Movimentações de {insumo.nome}</h3>
                {insumo.especificacao ? <p className="text-xs text-muted-foreground">{insumo.especificacao}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {dados?.localNome ?? "Todos os locais"}{referencia ? ` · posição em ${referencia}` : " · posição atual"}
                </p>
              </div>
              <div className="rounded-lg bg-primary/8 px-3 py-2 text-right">
                <p className="text-xs text-muted-foreground">{referencia ? "Saldo na data" : "Saldo atual"}</p>
                <p className="font-semibold tabular-nums">
                  {formatarQuantidade(dados?.saldoReferencia ?? insumo.quantidadeAtual)} {unidade}
                </p>
              </div>
            </div>

            {(!dados || pendente) && !erro && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando movimentações...
              </div>
            )}
            {erro && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
            {dados && !pendente && dados.movimentacoes.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma movimentação registrada até esta posição.
              </p>
            )}
            {dados && !pendente && dados.movimentacoes.length > 0 && (
              <>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Da mais antiga para a mais recente</span>
                  <span>Saldo antes deste trecho: <strong className="text-foreground">{formatarQuantidade(dados.saldoAnteriorAoTrecho)} {unidade}</strong></span>
                </div>
                <ol className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1" aria-label={`Últimas movimentações de ${dados.insumoNome}`}>
                  {dados.movimentacoes.map((movimento) => {
                    const entrada = TIPOS_ENTRADA.includes(movimento.tipo);
                    return (
                      <li key={movimento.id} className="rounded-lg border bg-background/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={entrada ? "success" : "destructive"}>{tipoMovimentacaoEstoqueLabels[movimento.tipo]}</Badge>
                              <time className="text-xs text-muted-foreground">{formatarDataHora(movimento.createdAt)}</time>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {movimento.localNome}{movimento.responsavelNome ? ` · ${movimento.responsavelNome}` : ""}
                            </p>
                            {movimento.observacao && <p className="mt-1 break-words text-xs">{movimento.observacao}</p>}
                          </div>
                          <div className="shrink-0 text-right tabular-nums">
                            <p className={cn("font-semibold", entrada ? "text-emerald-700" : "text-red-700")}>
                              {entrada ? "+" : "−"}{formatarQuantidade(movimento.quantidade)} {unidade}
                            </p>
                            <p className="text-xs text-muted-foreground">Saldo: {formatarQuantidade(movimento.saldo)} {unidade}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {dados.temMais && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mostrando as {dados.limite} movimentações mais recentes. Existem registros anteriores.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
