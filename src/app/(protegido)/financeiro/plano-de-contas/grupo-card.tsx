"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusAtivoSalvavel } from "@/components/status-ativo";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { grupoDreLabels, ORDEM_GRUPOS_DRE } from "@/lib/labels";
import { estilosNaturezaFinanceira, naturezaFinanceiraDoGrupo, type NaturezaFinanceira } from "@/lib/financeiro/natureza-financeira";
import { alturaDoRamoCategoria, idsDoRamoCategoria, nivelDaCategoria } from "@/lib/financeiro/hierarquia-categorias";
import { criarCategoriaFinanceiraAction, atualizarCategoriaFinanceiraAction, alternarAtivoCategoriaFinanceiraAction, excluirCategoriaFinanceiraAction } from "./actions";
import type { CategoriaFinanceiraRow } from "../types";
import type { FiltroStatusCategoria } from "./plano-contas-view";
import type { GrupoDre } from "@/generated/prisma/client";

type Centro = { id: string; nome: string };
type Edicao = { categoria?: CategoriaFinanceiraRow; pai?: CategoriaFinanceiraRow };
const SEM_CENTRO = "__nenhum__";
const SEM_DESTINO = "__sem_destino__";
const SEM_PAI = "__sem_pai__";

function correspondeAoFiltro(categoria: CategoriaFinanceiraRow, filtro: FiltroStatusCategoria) {
  if (filtro === "TODAS") return true;
  if (filtro === "EXCLUIDAS") return !!categoria.excluidoEm;
  if (categoria.excluidoEm) return false;
  return filtro === "ATIVAS" ? categoria.ativo : !categoria.ativo;
}

function caminhoDaCategoria(categoria: CategoriaFinanceiraRow, categorias: CategoriaFinanceiraRow[]) {
  const partes = [categoria.nome];
  let paiId = categoria.paiId;
  while (paiId) {
    const pai = categorias.find((item) => item.id === paiId);
    if (!pai) break;
    partes.unshift(pai.nome);
    paiId = pai.paiId;
  }
  return partes.join(" › ");
}

function FormularioCategoria({ grupo, edicao, categorias, centrosCusto, fechar }: {
  grupo: GrupoDre; edicao: Edicao; categorias: CategoriaFinanceiraRow[]; centrosCusto: Centro[]; fechar: () => void;
}) {
  const [nome, definirNome] = useState(edicao.categoria?.nome ?? "");
  const [centroId, definirCentroId] = useState(edicao.categoria?.centroCustoId ?? SEM_CENTRO);
  const [grupoSelecionado, definirGrupoSelecionado] = useState<GrupoDre>(edicao.categoria?.grupo ?? grupo);
  const [paiId, definirPaiId] = useState(edicao.categoria?.paiId ?? edicao.pai?.id ?? SEM_PAI);
  const [salvando, iniciar] = useTransition();
  const [erro, definirErro] = useState("");
  const estilo = estilosNaturezaFinanceira[naturezaFinanceiraDoGrupo(grupoSelecionado)];
  const categoriaEditada = edicao.categoria;
  const gruposPermitidos = ORDEM_GRUPOS_DRE.filter((opcao) => !categoriaEditada || naturezaFinanceiraDoGrupo(opcao) === naturezaFinanceiraDoGrupo(categoriaEditada.grupo));
  const idsRamo = categoriaEditada ? idsDoRamoCategoria(categoriaEditada.id, categorias) : new Set<string>();
  const alturaRamo = categoriaEditada ? alturaDoRamoCategoria(categoriaEditada.id, categorias) : 0;
  const paisPossiveis = categoriaEditada ? categorias.filter((categoria) => {
    if (!categoria.ativo || categoria.excluidoEm || categoria.grupo !== grupoSelecionado || idsRamo.has(categoria.id)) return false;
    const nivel = nivelDaCategoria(categoria.id, categorias);
    return nivel !== null && alturaRamo !== null && nivel + 1 + alturaRamo <= 2;
  }) : [];
  function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    iniciar(async () => {
      try {
        const dados = new FormData();
        dados.set("nome", nome);
        dados.set("grupo", grupo);
        dados.set("centroCustoId", centroId);
        if (edicao.pai) dados.set("paiId", edicao.pai.id);
        const resultado = edicao.categoria
          ? await atualizarCategoriaFinanceiraAction(edicao.categoria.id, {
              nome,
              centroCustoId: centroId === SEM_CENTRO ? null : centroId,
              grupo: grupoSelecionado,
              paiId: paiId === SEM_PAI ? null : paiId,
            })
          : await criarCategoriaFinanceiraAction(null, dados);
        if ("erro" in resultado) { definirErro(resultado.erro); return; }
        toast.success("Categoria salva.");
        fechar();
      } catch { definirErro("Não foi possível salvar. Tente novamente."); }
    });
  }
  return <form onSubmit={salvar} className="space-y-4">
    <DialogHeader>
      <DialogTitle>{edicao.categoria ? "Editar categoria" : edicao.pai ? "Nova subcategoria" : "Nova categoria"}</DialogTitle>
      <DialogDescription>{edicao.categoria ? caminhoDaCategoria(edicao.categoria, categorias) : edicao.pai ? `Dentro de ${edicao.pai.nome} · ${grupoDreLabels[grupo]}` : grupoDreLabels[grupo]}</DialogDescription>
    </DialogHeader>
    <div className="space-y-1.5"><Label htmlFor="nome-categoria">Nome</Label><Input id="nome-categoria" value={nome} onChange={(evento) => definirNome(evento.target.value)} disabled={salvando} required autoFocus /></div>
    <div className="space-y-1.5"><Label htmlFor="centro-categoria">Centro de custo</Label>
      <Select value={centroId} onValueChange={(valor) => definirCentroId(valor ?? SEM_CENTRO)} disabled={salvando}>
        <SelectTrigger id="centro-categoria" className="w-full"><SelectValue>{() => centrosCusto.find((centro) => centro.id === centroId)?.nome ?? "Sem centro"}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value={SEM_CENTRO}>Sem centro</SelectItem>{centrosCusto.map((centro) => <SelectItem key={centro.id} value={centro.id}>{centro.nome}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {categoriaEditada && <>
      <div className="space-y-1.5"><Label htmlFor="grupo-categoria">Grupo da DRE</Label>
        <Select value={grupoSelecionado} onValueChange={(valor) => {
          const novoGrupo = valor as GrupoDre;
          definirGrupoSelecionado(novoGrupo);
          const paiAtual = categorias.find((categoria) => categoria.id === paiId);
          if (!paiAtual || paiAtual.grupo !== novoGrupo) definirPaiId(SEM_PAI);
        }} disabled={salvando}>
          <SelectTrigger id="grupo-categoria" className="w-full"><SelectValue>{() => grupoDreLabels[grupoSelecionado]}</SelectValue></SelectTrigger>
          <SelectContent>{gruposPermitidos.map((opcao) => <SelectItem key={opcao} value={opcao}>{grupoDreLabels[opcao]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="pai-categoria">Categoria superior</Label>
        <Select value={paiId} onValueChange={(valor) => definirPaiId(valor ?? SEM_PAI)} disabled={salvando}>
          <SelectTrigger id="pai-categoria" className="w-full"><SelectValue>{() => {
            const pai = paisPossiveis.find((categoria) => categoria.id === paiId);
            return pai ? caminhoDaCategoria(pai, categorias) : "Sem categoria superior";
          }}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value={SEM_PAI}>Sem categoria superior</SelectItem>{paisPossiveis.map((categoria) => <SelectItem key={categoria.id} value={categoria.id}>{caminhoDaCategoria(categoria, categorias)}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Ao trocar o grupo, as subcategorias deste ramo acompanham a alteração. O plano continua limitado a três níveis.</p>
      </div>
    </>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <DialogFooter><Button type="button" variant="outline" disabled={salvando} onClick={fechar}>Voltar</Button><Button type="submit" variant={estilo.varianteBotao} disabled={salvando || !nome.trim()}>{salvando && <Loader2 className="size-4 animate-spin" />}Salvar</Button></DialogFooter>
  </form>;
}

function ConfirmarExclusao({ categoria, categorias, fechar }: {
  categoria: CategoriaFinanceiraRow;
  categorias: CategoriaFinanceiraRow[];
  fechar: () => void;
}) {
  const acesso = useAcesso();
  const roteador = useRouter();
  const [destinoId, definirDestinoId] = useState(SEM_DESTINO);
  const [processando, iniciar] = useTransition();
  const [erro, definirErro] = useState("");
  const quantidadeVinculos = categoria.quantidadeLancamentos + categoria.quantidadeItensNota + categoria.quantidadeItensFatura + categoria.quantidadeRegrasCartao;
  const destinos = categorias.filter((item) => item.id !== categoria.id && item.ativo && !item.excluidoEm && item.grupo === categoria.grupo);

  function concluir(acao: "INATIVAR" | "EXCLUIR") {
    definirErro("");
    iniciar(async () => {
      try {
        const resultado = acao === "INATIVAR"
          ? await alternarAtivoCategoriaFinanceiraAction(categoria.id, false)
          : await excluirCategoriaFinanceiraAction(categoria.id, destinoId === SEM_DESTINO ? null : destinoId);
        if ("erro" in resultado) { definirErro(resultado.erro); return; }
        toast.success(acao === "INATIVAR"
          ? "Categoria inativada. Os lançamentos históricos foram mantidos."
          : quantidadeVinculos > 0
            ? `${quantidadeVinculos} vínculo${quantidadeVinculos === 1 ? " transferido" : "s transferidos"}. Categoria excluída.`
            : "Categoria excluída.");
        fechar();
        roteador.refresh();
      } catch {
        definirErro(acao === "INATIVAR" ? "Não foi possível inativar a categoria." : "Não foi possível excluir a categoria.");
      }
    });
  }

  const bloqueadaPorFilhas = categoria.quantidadeSubcategorias > 0;
  return <>
    <DialogHeader>
      <DialogTitle>Excluir categoria</DialogTitle>
      <DialogDescription>
        {categoria.nome} ficará disponível somente no filtro Excluídas e não aparecerá em novos lançamentos.
      </DialogDescription>
    </DialogHeader>

    {bloqueadaPorFilhas ? <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
      Esta categoria possui {categoria.quantidadeSubcategorias} {categoria.quantidadeSubcategorias === 1 ? "subcategoria" : "subcategorias"}. Exclua primeiro as categorias que estão dentro dela.
    </div> : quantidadeVinculos > 0 ? <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
        Esta categoria possui {categoria.quantidadeLancamentos} {categoria.quantidadeLancamentos === 1 ? "movimentação financeira" : "movimentações financeiras"}
        {categoria.quantidadeItensNota > 0 ? `, ${categoria.quantidadeItensNota} ${categoria.quantidadeItensNota === 1 ? "item de nota vinculado" : "itens de nota vinculados"}` : ""}, {categoria.quantidadeItensFatura} {categoria.quantidadeItensFatura === 1 ? "item de fatura" : "itens de fatura"} e {categoria.quantidadeRegrasCartao} {categoria.quantidadeRegrasCartao === 1 ? "regra de cartão" : "regras de cartão"}.
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="categoria-destino">Transferir vínculos para</Label>
        <Select value={destinoId} onValueChange={(valor) => definirDestinoId(valor ?? SEM_DESTINO)} disabled={processando || destinos.length === 0}>
          <SelectTrigger id="categoria-destino" className="w-full"><SelectValue placeholder="Escolha a categoria de destino">{() => {
            const destino = destinos.find((item) => item.id === destinoId);
            return destino ? caminhoDaCategoria(destino, categorias) : "Escolha a categoria de destino";
          }}</SelectValue></SelectTrigger>
          <SelectContent>{destinos.map((item) => <SelectItem key={item.id} value={item.id}>{caminhoDaCategoria(item, categorias)}</SelectItem>)}</SelectContent>
        </Select>
        {destinos.length === 0 && <p className="text-xs text-destructive">Cadastre ou ative outra categoria neste grupo antes de excluir.</p>}
        <p className="text-xs text-muted-foreground">A transferência preserva os valores, datas e demais informações dos lançamentos.</p>
      </div>
    </div> : <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">Esta categoria não possui movimentações ou itens de nota vinculados.</p>}

    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <DialogFooter className="gap-2 sm:justify-between">
      <Button type="button" variant="outline" disabled={processando} onClick={fechar}>Cancelar</Button>
      <div className="flex flex-wrap justify-end gap-2">
        {!bloqueadaPorFilhas && quantidadeVinculos > 0 && categoria.ativo && <Button type="button" variant="outline" disabled={processando || !acesso.pode("financeiro.plano", "editar")} onClick={() => concluir("INATIVAR")}>Apenas inativar</Button>}
        {!bloqueadaPorFilhas && <Button type="button" variant="destructive" disabled={processando || (quantidadeVinculos > 0 && destinoId === SEM_DESTINO)} onClick={() => concluir("EXCLUIR")}>
          {processando && <Loader2 className="size-4 animate-spin" />}Excluir categoria
        </Button>}
      </div>
    </DialogFooter>
  </>;
}

function ItemCategoria({ categoria, categorias, nivel, caminho, natureza, filtroStatus, editar, excluir }: {
  categoria: CategoriaFinanceiraRow;
  categorias: CategoriaFinanceiraRow[];
  nivel: number;
  caminho: string;
  natureza: NaturezaFinanceira;
  filtroStatus: FiltroStatusCategoria;
  editar: (edicao: Edicao) => void;
  excluir: (categoria: CategoriaFinanceiraRow) => void;
}) {
  const acesso = useAcesso();
  const roteador = useRouter();
  const [aberta, definirAberta] = useState(false);
  const filhas = categorias.filter((item) => item.paiId === categoria.id);
  const estilo = estilosNaturezaFinanceira[natureza];
  const somenteContexto = !correspondeAoFiltro(categoria, filtroStatus);
  const excluida = !!categoria.excluidoEm;
  return <li className="min-w-0" data-natureza-financeira={natureza.toLowerCase()}>
    <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)_132px] items-center gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-4 ${somenteContexto ? "opacity-65" : ""}`}>
      <div className="flex min-w-0 flex-1 items-start gap-1.5">
        {filhas.length > 0 ? <button type="button" onClick={() => definirAberta(!aberta)} aria-expanded={aberta} aria-controls={`filhas-${categoria.id}`} aria-label={`${aberta ? "Recolher" : "Expandir"} ${caminho}`} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><ChevronRight className={`size-4 transition-transform ${aberta ? "rotate-90" : ""}`} /></button> : <span aria-hidden="true" className="size-6 shrink-0" />}
        <div className="min-w-0">
          <span className={`flex items-start gap-2 break-words text-sm ${filhas.length ? "font-semibold" : ""} ${categoria.ativo && !excluida ? "" : "text-muted-foreground line-through"}`}><span aria-hidden="true" className={`mt-1.5 size-1.5 shrink-0 rounded-full ${categoria.ativo && !excluida ? estilo.ponto : "bg-muted-foreground/50"}`} />{categoria.nome}</span>
          {filhas.length > 0 && <span className="text-xs text-muted-foreground">{filhas.length} {nivel === 0 ? (filhas.length === 1 ? "subcategoria" : "subcategorias") : (filhas.length === 1 ? "subdivisão" : "subdivisões")}</span>}
          {categoria.centroCustoNome && <Badge variant="muted" className="mt-1 max-w-full whitespace-normal text-[10px]">{categoria.centroCustoNome}</Badge>}
          {somenteContexto && <Badge variant="outline" className="mt-1 text-[10px]">Contexto</Badge>}
        </div>
      </div>
      <GrupoAcoes className="flex-wrap justify-end">
        {somenteContexto ? null : excluida ? <Badge variant="destructive">Excluída</Badge> : <>
          {nivel < 2 && categoria.ativo ? <Button size="icon" variant={estilo.varianteBotaoContorno} className="size-7 sm:size-8" disabled={!acesso.pode("financeiro.plano", "adicionar")} onClick={() => editar({ pai: categoria })} aria-label={`Adicionar subcategoria em ${caminho}`} title="Adicionar subcategoria"><Plus className="size-3.5" /></Button> : <span aria-hidden="true" className="size-7 sm:size-8" />}
          <Button disabled={!acesso.pode("financeiro.plano", "editar")} onClick={() => editar({ categoria })} aria-label={`Editar ${caminho}`} title="Editar categoria" variant="editar" />
          <Button variant="excluir" disabled={!acesso.pode("financeiro.plano", "excluir")} onClick={() => excluir(categoria)} aria-label={`Excluir ${caminho}`} title="Excluir categoria"><Trash2 className="size-3.5" /></Button>
          <StatusAtivoSalvavel ativo={categoria.ativo} nome={caminho} motivoBloqueio={!acesso.pode("financeiro.plano", "editar") ? "Seu acesso não permite editar categorias." : undefined} salvar={async (ativo) => {
            const resultado = await alternarAtivoCategoriaFinanceiraAction(categoria.id, ativo);
            if (!("erro" in resultado)) roteador.refresh();
            return resultado;
          }} />
        </>}
      </GrupoAcoes>
    </div>
    {filhas.length > 0 && <ul id={`filhas-${categoria.id}`} hidden={!aberta} className="ml-3 divide-y divide-border/40 border-l border-border/70 pl-2 sm:ml-3 sm:pl-5">
      {filhas.map((filha) => <ItemCategoria key={filha.id} categoria={filha} categorias={categorias} nivel={nivel + 1} caminho={`${caminho} › ${filha.nome}`} natureza={natureza} filtroStatus={filtroStatus} editar={editar} excluir={excluir} />)}
    </ul>}
  </li>;
}

export function GrupoCard({ grupo, categorias, todasCategorias = categorias, centrosCusto, ordem, abertoInicial = true, filtroStatus = "ATIVAS" }: {
  grupo: GrupoDre;
  categorias: CategoriaFinanceiraRow[];
  todasCategorias?: CategoriaFinanceiraRow[];
  centrosCusto: Centro[];
  ordem?: number;
  abertoInicial?: boolean;
  filtroStatus?: FiltroStatusCategoria;
}) {
  const acesso = useAcesso();
  const [aberto, definirAberto] = useState(abertoInicial);
  const [edicao, definirEdicao] = useState<Edicao | null>(null);
  const [exclusao, definirExclusao] = useState<CategoriaFinanceiraRow | null>(null);
  const natureza = naturezaFinanceiraDoGrupo(grupo);
  const estilo = estilosNaturezaFinanceira[natureza];
  const idsVisiveis = new Set(categorias.filter((categoria) => correspondeAoFiltro(categoria, filtroStatus)).map((categoria) => categoria.id));
  for (let indice = 0; indice < categorias.length; indice++) {
    for (const categoria of categorias) {
      if (idsVisiveis.has(categoria.id) && categoria.paiId) idsVisiveis.add(categoria.paiId);
    }
  }
  const categoriasVisiveis = categorias.filter((categoria) => idsVisiveis.has(categoria.id));
  const raizes = categoriasVisiveis.filter((categoria) => !categoria.paiId || !idsVisiveis.has(categoria.paiId));
  const correspondentes = categorias.filter((categoria) => correspondeAoFiltro(categoria, filtroStatus));
  const subcategorias = correspondentes.filter((categoria) => categorias.some((raiz) => raiz.id === categoria.paiId && !raiz.paiId)).length;
  const subdivisoes = correspondentes.filter((categoria) => categorias.some((pai) => pai.id === categoria.paiId && !!pai.paiId)).length;
  const categoriasRaiz = correspondentes.length - subcategorias - subdivisoes;
  const resumo = correspondentes.length === 0 ? "Nenhuma categoria neste status" : [
    `${categoriasRaiz} ${categoriasRaiz === 1 ? "categoria" : "categorias"}`,
    subcategorias > 0 && `${subcategorias} ${subcategorias === 1 ? "subcategoria" : "subcategorias"}`,
    subdivisoes > 0 && `${subdivisoes} ${subdivisoes === 1 ? "subdivisão" : "subdivisões"}`,
  ].filter(Boolean).join(" · ");
  return <Card className={`gap-0 py-0 ${estilo.borda}`} data-natureza-financeira={natureza.toLowerCase()}>
    <div className="flex items-center gap-2 px-3 sm:px-5">
      <h2 className="min-w-0 flex-1">
        <button type="button" onClick={() => definirAberto(!aberto)} aria-expanded={aberto} aria-controls={`grupo-${grupo}`} aria-label={`${aberto ? "Recolher" : "Expandir"} grupo ${grupoDreLabels[grupo]}`} className="flex w-full items-center gap-3 rounded-lg py-4 text-left focus-visible:outline-2 focus-visible:outline-primary sm:gap-4 sm:py-5">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums ${estilo.indicador}`}>{String(ordem ?? 1).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className={`text-sm font-semibold sm:text-base ${estilo.texto}`}>{grupoDreLabels[grupo]}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${estilo.indicador}`}>{estilo.rotulo}</span></span><span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">{resumo}</span></span>
          <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`} />
        </button>
      </h2>
      {(filtroStatus === "TODAS" || filtroStatus === "ATIVAS" || filtroStatus === "INATIVAS") && <Button variant={estilo.varianteBotaoContorno} size="sm" className="shrink-0" disabled={!acesso.pode("financeiro.plano", "adicionar")} onClick={() => definirEdicao({})} aria-label={`Adicionar categoria em ${grupoDreLabels[grupo]}`} title="Adicionar categoria"><Plus className="size-4" /><span className="hidden sm:inline">Categoria</span></Button>}
    </div>
    <div id={`grupo-${grupo}`} hidden={!aberto} className="border-t border-border/60 px-3 pb-2 sm:px-5">
      {correspondentes.length > 0 ? <>
        <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-2 border-b border-border/60 py-2.5 text-[11px] font-medium text-muted-foreground sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-4"><span className="pl-7">Categoria</span><span className="text-right">Ações · Status</span></div>
        <ul className="divide-y divide-border/60">{raizes.map((categoria) => <ItemCategoria key={categoria.id} categoria={categoria} categorias={categoriasVisiveis} nivel={0} caminho={categoria.nome} natureza={natureza} filtroStatus={filtroStatus} editar={definirEdicao} excluir={definirExclusao} />)}</ul>
      </> : <p className="py-4 text-sm text-muted-foreground">{filtroStatus === "TODAS" ? "Nenhuma categoria cadastrada neste grupo." : `Nenhuma categoria ${filtroStatus === "ATIVAS" ? "ativa" : filtroStatus === "INATIVAS" ? "inativa" : "excluída"} neste grupo.`}</p>}
    </div>
    <Dialog open={!!edicao} onOpenChange={(aberto) => !aberto && definirEdicao(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {edicao && <FormularioCategoria grupo={grupo} edicao={edicao} categorias={todasCategorias} centrosCusto={centrosCusto} fechar={() => definirEdicao(null)} />}
      </DialogContent>
    </Dialog>
    <Dialog open={!!exclusao} onOpenChange={(aberto) => !aberto && definirExclusao(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {exclusao && <ConfirmarExclusao categoria={exclusao} categorias={categorias} fechar={() => definirExclusao(null)} />}
      </DialogContent>
    </Dialog>
  </Card>;
}
