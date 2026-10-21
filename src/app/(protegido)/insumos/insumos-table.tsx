"use client";

import { SelecaoFormulario } from "@/components/ui/select";
import type { CategoriaOption } from "@/app/(protegido)/financeiro/types";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Globe, ChevronRight } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { CampoBusca } from "@/components/campo-busca";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { IconeInsumo, IconePreparacao } from "@/components/icones-insumos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InsumoActionsCell } from "@/app/(protegido)/insumos/insumo-actions-cell";
import { InsumoDialog } from "@/app/(protegido)/insumos/insumo-dialog";
import { FichaTecnicaButton } from "@/app/(protegido)/insumos/ficha-tecnica-button";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { tipoProdutoGlobalLabels, unidadeMedidaAbreviada, unidadeMedidaLabels } from "@/lib/labels";
import { TipoEstoqueBadge } from "@/components/tipo-estoque-badge";
import { ReferenciasConversao } from "@/components/referencias-conversao";
import { marcasDoInsumo } from "@/lib/insumos/marcas";
import type { InsumoRow, SimpleOption, FornecedorOption, InsumoOption } from "@/app/(protegido)/insumos/types";
import { StatusAtivoSalvavel } from "@/components/status-ativo";
import { alterarStatusInsumoAction } from "../status-cadastros-actions";
import { TipoProdutoGlobal } from "@/generated/prisma/browser";
import { cn } from "cn";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { Tabs, TabsList, TabsTriggerBotao, TabsContent } from "@/components/ui/tabs";
import { MovimentacoesItem } from "./movimentacoes-item";
import { ValidadesInsumo } from "./validades-insumo";

const PAGE_SIZE = 25;
const COLUNAS = 8;

function normalizar(valor: string) {
  const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
  return valor.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

export function InsumosTable({
  insumos,
  categorias,
  categoriasFinanceiras = [],
  centrosCusto,
  fornecedores,
  todosInsumos,
  podeCadastrarFornecedor,
  podeCadastrarInsumo,
  podeConfigurarEtiqueta,
  entidadeInicialId,
}: {
  insumos: InsumoRow[];
  categorias: SimpleOption[];
  categoriasFinanceiras?: CategoriaOption[];
  centrosCusto: SimpleOption[];
  fornecedores: FornecedorOption[];
  todosInsumos: InsumoOption[];
  podeCadastrarFornecedor?: boolean;
  podeCadastrarInsumo?: boolean;
  podeConfigurarEtiqueta?: boolean;
  entidadeInicialId?: string;
}) {
  const insumoInicial = insumos.find(i => i.id === entidadeInicialId);
  const inicialId = insumoInicial?.id;
  const exibirInativosInicial = Boolean(insumoInicial && !insumoInicial.ativo);
  const [query, setQuery] = useState("");
  const editar = useAcesso().pode("insumos", "editar");
  const [filtroTipo, setFiltroTipo] = useState<TipoProdutoGlobal | "TODOS">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "ATIVOS" | "INATIVOS">(exibirInativosInicial ? "TODOS" : "ATIVOS");
  const [pagina, setPagina] = useState(() => inicialId ? Math.floor(insumos.filter(i => exibirInativosInicial || i.ativo).findIndex(i => i.id === inicialId) / PAGE_SIZE) + 1 : 1);
  const [expandidoId, setExpandidoId] = useState<string | null>(inicialId ?? null);
  useEffect(() => {
    if (!inicialId) return;
    const botao = document.getElementById(`expansao-insumo-${inicialId}`);
    botao?.scrollIntoView?.({ block: "center" });
    botao?.focus({ preventScroll: true });
  }, [inicialId]);
  const [ordenacao, setOrdenacao] = useState<{ coluna: "nome" | "marca" | "tipo" | "unidade" | "categoria" | "fornecedores"; direcao: "asc" | "desc" } | null>(null);

  function alternarLinha(id: string) {
    setExpandidoId((atual) => (atual === id ? null : id));
  }

  function alternarOrdenacao(coluna: "nome" | "marca" | "tipo" | "unidade" | "categoria" | "fornecedores") {
    setExpandidoId(null);
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna, direcao: "desc" };
      return null;
    });
  }

  const CHAVE_ORDENACAO: Record<"nome" | "marca" | "tipo" | "unidade" | "categoria" | "fornecedores", (i: InsumoRow) => string> = {
    nome: (i) => i.nome,
    marca: (i) => marcasDoInsumo(i).join(" "),
    tipo: (i) => tipoProdutoGlobalLabels[i.tipo],
    unidade: (i) => unidadeMedidaLabels[i.unidade],
    categoria: (i) => i.categoria?.nome ?? "",
    fornecedores: (i) => i.fornecedoresHomologados.map((f) => f.nome).join(", "),
  };

  const encontrados = useMemo(() => {
    const termo = normalizar(query.trim());
    const resultado = insumos.filter((insumo) => {
      if (!termo) return true;
      const alvo = normalizar([insumo.nome, insumo.especificacao ?? "", ...marcasDoInsumo(insumo), insumo.codigoEan ?? "", insumo.categoria?.nome ?? "", ...insumo.fornecedoresHomologados.map((f) => f.nome)].join(" "));
      return alvo.includes(termo);
    });
    return resultado;
  }, [query, insumos]);

  const porStatus = encontrados.filter(i => filtroStatus === "TODOS" || i.ativo === (filtroStatus === "ATIVOS"));
  const porTipo = encontrados.filter(i => filtroTipo === "TODOS" || i.tipo === filtroTipo);
  const filtrados = useMemo(() => {
    const resultado = encontrados.filter(i =>
      (filtroStatus === "TODOS" || i.ativo === (filtroStatus === "ATIVOS")) &&
      (filtroTipo === "TODOS" || i.tipo === filtroTipo));
    if (!ordenacao) return resultado;
    const extrair = CHAVE_ORDENACAO[ordenacao.coluna];
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...resultado].sort((a, b) => sinal * extrair(a).localeCompare(extrair(b), "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encontrados, filtroTipo, filtroStatus, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  function mudarFiltro(tipo: TipoProdutoGlobal | "TODOS") {
    setExpandidoId(null);
    setFiltroTipo(tipo);
    setPagina(1);
  }

  function mudarPagina(proxima: number) {
    setExpandidoId(null);
    setPagina(proxima);
  }

  if (insumos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Globe className="size-8 text-muted-foreground" />
          <p className="font-medium">Nenhum insumo encontrado.</p>
          <p className="text-sm text-muted-foreground">Sua rede não possui itens configurados no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-4 py-4">
      <div className="flex flex-wrap items-center gap-2 px-4">
        <CampoBusca
          value={query}
          onChange={(valor) => {
            setExpandidoId(null);
            setQuery(valor);
            setPagina(1);
          }}
          placeholder="Insumo, marca, categoria ou fornecedor..."
          aria-label="Buscar insumo, marca, categoria ou fornecedor"
        />
        <FiltroOpcoesContadas nome="Filtrar insumos por tipo" valor={filtroTipo} onValueChange={mudarFiltro} opcoes={[
          { valor: "TODOS", nome: "Todos", quantidade: porStatus.length },
          { valor: TipoProdutoGlobal.INSUMO, nome: "Insumos", quantidade: porStatus.filter(i => i.tipo === TipoProdutoGlobal.INSUMO).length, icone: <IconeInsumo className="size-4" monocromatico={filtroTipo === TipoProdutoGlobal.INSUMO} /> },
          { valor: TipoProdutoGlobal.PRODUTO_INTERMEDIARIO, nome: "Preparações", quantidade: porStatus.filter(i => i.tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO).length, icone: <IconePreparacao className="size-4" monocromatico={filtroTipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO} /> },
        ]} />
        <SelecaoFormulario aria-label="Filtrar insumos por status" value={filtroStatus}
         onValueChange={novoValor => { setFiltroStatus(novoValor as typeof filtroStatus); setPagina(1); setExpandidoId(null); }}
          className="max-w-48 font-medium focus-visible:outline-2 focus-visible:outline-ring sm:ml-auto">
          <option value="TODOS">Todos os status ({porTipo.length})</option><option value="ATIVOS">Ativos ({porTipo.filter(i => i.ativo).length})</option><option value="INATIVOS">Inativos ({porTipo.filter(i => !i.ativo).length})</option>
        </SelecaoFormulario>
      </div>

      {filtrados.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum insumo encontrado com os filtros selecionados.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  active={ordenacao?.coluna === "nome"}
                  direction={ordenacao?.direcao}
                  onClick={() => alternarOrdenacao("nome")}
                >
                  Insumo
                </SortableTableHead>
                <SortableTableHead
                  active={ordenacao?.coluna === "marca"}
                  direction={ordenacao?.direcao}
                  onClick={() => alternarOrdenacao("marca")}
                >
                  Marca
                </SortableTableHead>
                <SortableTableHead
                  active={ordenacao?.coluna === "tipo"}
                  direction={ordenacao?.direcao}
                  onClick={() => alternarOrdenacao("tipo")}
                >
                  Tipo
                </SortableTableHead>
                <SortableTableHead
                  active={ordenacao?.coluna === "unidade"}
                  direction={ordenacao?.direcao}
                  onClick={() => alternarOrdenacao("unidade")}
                >
                  Unidade
                </SortableTableHead>
                <SortableTableHead
                  active={ordenacao?.coluna === "categoria"}
                  direction={ordenacao?.direcao}
                  onClick={() => alternarOrdenacao("categoria")}
                >
                  Categoria
                </SortableTableHead>
                <SortableTableHead active={ordenacao?.coluna === "fornecedores"} direction={ordenacao?.direcao}
                  onClick={() => alternarOrdenacao("fornecedores")}>Fornecedores</SortableTableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginados.map((insumo) => {
                const aberto = expandidoId === insumo.id;
                return (
                  <Fragment key={insumo.id}>
                    <TableRow
                      className={cn("cursor-pointer", aberto && "border-b-0")}
                      onClick={() => alternarLinha(insumo.id)}
                    >
                      <TableCell className="w-[26%] whitespace-normal">
                        <div className="flex items-center gap-2.5">
                          <button
                            id={`expansao-insumo-${insumo.id}`}
                            type="button"
                            aria-expanded={aberto}
                            aria-label={aberto ? `Fechar detalhes de ${insumo.nome}` : `Abrir detalhes de ${insumo.nome}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              alternarLinha(insumo.id);
                            }}
                            className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <ChevronRight className={cn("size-4 transition-transform duration-200", aberto && "rotate-90")} />
                          </button>
                          {insumo.temFoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/insumos/${insumo.id}/foto?v=${new Date(insumo.updatedAt).getTime()}`}
                              alt=""
                              className="hidden size-8 rounded-md object-cover sm:block"
                            />
                          ) : (
                            <div className="hidden size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground sm:flex">
                              {insumo.tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO ? <IconePreparacao className="size-6" /> : <IconeInsumo className="size-6" />}
                            </div>
                          )}
                          <IdentificacaoInsumo nome={insumo.nome} especificacao={insumo.especificacao} nomeClassName="font-medium" />
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="flex max-w-[340px] flex-wrap gap-1">
                          {marcasDoInsumo(insumo).length
                            ? marcasDoInsumo(insumo).map((marca) => <Badge key={marca} variant="outline" className="max-w-full whitespace-normal break-words">{marca}</Badge>)
                            : <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{tipoProdutoGlobalLabels[insumo.tipo]}</Badge>
                      </TableCell>
                      <TableCell>{unidadeMedidaLabels[insumo.unidade]}</TableCell>
                      <TableCell>
                        {insumo.categoria ? (
                          // Categorias têm nomes longos ("Embalagens e Descartáveis de..."); sem
                          // limite elas esticam a tabela e empurram o painel expandido pra fora.
                          <span className="block max-w-[260px] whitespace-normal break-words" title={insumo.categoria.nome}>
                            {insumo.categoria.nome}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <span className="block max-w-[280px] break-words">
                          {insumo.fornecedoresHomologados.length ? insumo.fornecedoresHomologados.map((f) => f.nome).join(", ") : <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>
                      <TableCell><StatusAtivoSalvavel motivoBloqueio={!editar ? "Seu perfil permite apenas consultar." : undefined} ativo={insumo.ativo} nome={insumo.nome} salvar={ativo => alterarStatusInsumoAction(insumo.id, ativo)} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <InsumoActionsCell insumo={insumo} edicao={editar && (
                          <InsumoDialog
                            insumo={insumo}
                            categorias={categorias}
                            categoriasFinanceiras={categoriasFinanceiras}
                            centrosCusto={centrosCusto}
                            fornecedores={fornecedores}
                            todosInsumos={todosInsumos}
                            podeCadastrarFornecedor={podeCadastrarFornecedor}
                            podeCadastrarInsumo={podeCadastrarInsumo}
                            podeConfigurarEtiqueta={podeConfigurarEtiqueta}
                            trigger={<Button type="button" aria-label="Editar" variant="editar" size="icon-sm" />}
                          />
                        )} />
                      </TableCell>
                    </TableRow>

                    {aberto && (
                      <LinhaExpandida
                        insumo={insumo}
                        somenteLeitura={inicialId === insumo.id}
                        onFechar={() => setExpandidoId(null)}
                      />
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between px-4 text-xs text-muted-foreground">
            <span>
              Mostrando {paginados.length} de {filtrados.length} insumos
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={paginaAtual <= 1} onClick={() => mudarPagina(paginaAtual - 1)}>
                Anterior
              </Button>
              <span>Pag. {paginaAtual}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => mudarPagina(paginaAtual + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function Campo({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div className="min-w-[6.5rem]">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="text-sm break-words">{valor}</div>
    </div>
  );
}

// Resumo de consulta; a edição fica exclusivamente nas ações da linha principal.
function ResumoInsumo({ insumo, somenteLeitura = false }: { insumo: InsumoRow; somenteLeitura?: boolean }) {
  const editar = useAcesso().pode("insumos", "editar");
  const ehIntermediario = insumo.tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO;

  return (
    <div className="flex flex-wrap items-start gap-4">
      {insumo.temFoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/insumos/${insumo.id}/foto?v=${new Date(insumo.updatedAt).getTime()}`}
          alt=""
          className="size-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
          {ehIntermediario ? <IconePreparacao className="size-10" /> : <IconeInsumo className="size-10" />}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-wrap gap-x-6 gap-y-2.5">
        <Campo label="Nome" valor={insumo.nome} />
        <Campo label="Especificação" valor={insumo.especificacao ?? "—"} />
        <Campo label="Categoria" valor={insumo.categoria?.nome ?? "—"} />
        <Campo label="Unidade" valor={unidadeMedidaLabels[insumo.unidade]} />
        {(insumo.conversoes?.length ?? 0) > 0 && <Campo label="Fatores de conversão" valor={<ReferenciasConversao conversoes={insumo.conversoes} unidade={insumo.unidade} />} />}
        <Campo label="Tipo de estoque" valor={insumo.tipoEstoque ? <TipoEstoqueBadge tipo={insumo.tipoEstoque} /> : "—"} />
        <Campo label="Centro de custo" valor={insumo.centroCusto?.nome ?? "—"} />
        <Campo label="Marcas homologadas" valor={<div className="flex flex-wrap gap-1">{marcasDoInsumo(insumo).length ? marcasDoInsumo(insumo).map((marca) => <Badge key={marca} variant="outline" className="max-w-full whitespace-normal break-words">{marca}</Badge>) : "—"}</div>} />
        <Campo label="Cód. / EAN" valor={insumo.codigoEan ?? "—"} />
        <Campo label="Estoque mín. / máx." valor={`${insumo.estoqueMinimo} / ${insumo.estoqueMaximo ?? "—"}`} />
        {ehIntermediario ? (
          <Campo
            label={`Custo médio (${unidadeMedidaAbreviada[insumo.unidade]})`}
            valor={insumo.custoUnitarioPreparacao != null
              ? `${insumo.custoUnitarioPreparacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 })}/${unidadeMedidaAbreviada[insumo.unidade]}`
              : <span className="text-muted-foreground">{insumo.motivoCustoPreparacao ?? "Custo indisponível."}</span>}
          />
        ) : <Campo label={`Custo médio (${unidadeMedidaAbreviada[insumo.unidade]})`} valor={insumo.custoMedio == null ? "Indisponível para seu acesso" : formatarMoeda(insumo.custoMedio)} />}
        <Campo
          label="Fornecedores homologados"
          valor={
            insumo.fornecedoresHomologados.length === 0
              ? "—"
              : insumo.fornecedoresHomologados.map((f, i) => (
                  <span key={f.id}>
                    {i > 0 && ", "}
                    <span className={f.id === insumo.fornecedorPrincipalId ? "font-semibold text-foreground" : undefined}>
                      {f.nome}
                      {f.id === insumo.fornecedorPrincipalId && " ★"}
                    </span>
                  </span>
                ))
          }
        />
        <Campo
          label="Status"
          valor={<StatusAtivoSalvavel motivoBloqueio={somenteLeitura ? "Consulta somente leitura." : !editar ? "Seu perfil permite apenas consultar." : undefined} ativo={insumo.ativo} nome={insumo.nome} salvar={ativo => alterarStatusInsumoAction(insumo.id, ativo)} />}
        />
        {ehIntermediario && (
          <Campo
            label="Composição"
            valor={insumo.componentes.length === 0 ? "—" : insumo.componentes.map((c) => `${c.quantidade} ${unidadeMedidaLabels[c.unidade]} de ${c.nome}${c.observacaoPorcao ? ` (${c.observacaoPorcao})` : ""}`).join(", ")}
          />
        )}
        {ehIntermediario && (
          <Campo
            label="Rendimento final"
            valor={
              insumo.rendimentoQuantidade && insumo.rendimentoUnidade
                ? `${insumo.rendimentoQuantidade} ${unidadeMedidaLabels[insumo.rendimentoUnidade]}`
                : "—"
            }
          />
        )}
        <Campo label="Categoria financeira" valor={insumo.categoriaFinanceira?.nome ?? "Padrão CMV"} />
        {ehIntermediario && <Campo label="Modo de preparo" valor={(insumo.modoPreparo?.length ?? 0) > 0 ? `${insumo.modoPreparo!.length} passo${insumo.modoPreparo!.length === 1 ? "" : "s"}` : "—"} />}
      </div>

      {ehIntermediario && (
        <GrupoAcoes nome={`Ações de ${insumo.nome}`} className="shrink-0 flex-wrap">
          <FichaTecnicaButton preparacao={insumo} />
        </GrupoAcoes>
      )}
    </div>
  );
}

// Painel que nasce embaixo da linha clicada, acompanhando a largura visível da
// tabela (nunca vaza pra fora, mesmo com scroll horizontal).
function LinhaExpandida({
  insumo,
  onFechar,
  somenteLeitura = false,
}: {
  insumo: InsumoRow;
  onFechar: () => void;
  somenteLeitura?: boolean;
}) {
  const [entrou, setEntrou] = useState(false);
  const [larguraVisivel, setLarguraVisivel] = useState<number | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const consultarMovimentacoes = useAcesso().pode("inventario");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntrou(true));

    const area = painelRef.current?.closest<HTMLElement>('[data-slot="table-container"]');
    if (!area) return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(() => setLarguraVisivel(area.clientWidth));
    observer.observe(area);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={COLUNAS} className="p-0 whitespace-normal">
        {/* w-0: zera a contribuição do painel no cálculo de largura da tabela,
            senão o conteúdo largo estica as colunas da listagem. */}
        <div style={larguraVisivel ? { width: larguraVisivel } : undefined} className="sticky left-0 w-0">
          <div
            ref={painelRef}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !e.defaultPrevented) {
                e.stopPropagation();
                onFechar();
              }
            }}
            className={cn(
              "border-l-2 border-primary p-4 outline-none",
              entrou && "animate-in fade-in slide-in-from-top-2 duration-200 ease-out"
            )}
          >
            <Tabs defaultValue="dados"><TabsList variant="buttons" aria-label={`Detalhes de ${insumo.nome}`}><TabsTriggerBotao value="dados">Dados do item</TabsTriggerBotao><TabsTriggerBotao value="validades">Validades</TabsTriggerBotao>{consultarMovimentacoes && <TabsTriggerBotao value="movimentacoes">Movimentações</TabsTriggerBotao>}</TabsList>
              <TabsContent value="dados"><ResumoInsumo insumo={insumo} somenteLeitura={somenteLeitura} /></TabsContent>
              <TabsContent value="validades"><ValidadesInsumo insumo={insumo} somenteLeitura={somenteLeitura} /></TabsContent>
              {consultarMovimentacoes && <TabsContent value="movimentacoes"><MovimentacoesItem insumoId={insumo.id} unidade={unidadeMedidaAbreviada[insumo.unidade]} /></TabsContent>}
            </Tabs>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
