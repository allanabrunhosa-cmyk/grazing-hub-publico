"use client";

import { SelecaoFormulario } from "@/components/ui/select";
import { useCallback, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Archive, CalendarClock, CalendarDays, ChevronDown, ChevronRight, Filter, LayoutGrid, List, PackageCheck, TriangleAlert, Tag } from "lucide-react";
import { FotoProduto } from "./foto-produto";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { baixarEtiquetaAction } from "./operacao-actions";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Button, buttonVariants } from "@/components/ui/button";
import { CampoBusca } from "@/components/campo-busca";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EtiquetaPreview } from "./etiqueta-preview";
import { rotuloConservacaoEtiqueta, type ConservacaoEtiquetaValor, type DadosEtiqueta } from "@/lib/etiquetas/tipos";
import { periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { type FiltroValidade } from "@/lib/etiquetas/gestao-validades";

type ItemValidade = {
  id: string; insumoId?: string | null; fotoUrl?: string | null; produtoNome: string; categoriaNome: string | null; lote: string | null;
  validoAte: string; manipuladoEm: string; fusoHorario: string; responsavelManipulacao: string;
  conservacao: ConservacaoEtiquetaValor; copias: number; copiasBaixadas?: number; status: string; confirmado: boolean; dados: DadosEtiqueta;
};

export type GestaoValidadesTela = {
  agora: string; filtro: FiltroValidade; pagina: number; porPagina: number; total: number;
  vencidas: number; proximas: number; vigentes: number; itens: ItemValidade[];
};

function dataLocal(iso: string, fuso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function deslocarData(data: Date, dias: number) {
  const copia = new Date(data); copia.setUTCDate(copia.getUTCDate() + dias); return copia.toISOString().slice(0, 10);
}

export function PainelValidades({ dados, caminhoBase, acoes }: { dados: GestaoValidadesTela; caminhoBase: string; acoes?: ReactNode }) {
  const id = useId();
  const agora = new Date(dados.agora);
  const periodoInicial = periodoMesAteHoje(agora);
  const roteador = useRouter();
  const podeBaixar = useAcesso().pode("producao.validades", "editar");
  const [pendente, iniciar] = useTransition();
  const [quantidadeBaixa, setQuantidadeBaixa] = useState("1");
  const [confirmarBaixa, setConfirmarBaixa] = useState(false);
  const chaveBaixa = useRef("");
  const travaBaixa = useRef(false);
  const chavesDiretas = useRef(new Map<string, string>());
  const [registrandoId, setRegistrandoId] = useState<string | null>(null);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  const [estado, setEstado] = useState("ativas");
  const [baixasLocais, setBaixasLocais] = useState<Record<string, number>>({});
  const baixadas = useCallback((item: ItemValidade) => Math.max(item.copiasBaixadas ?? 0, baixasLocais[item.id] ?? 0), [baixasLocais]);
  const restantes = useCallback((item: ItemValidade) => item.copias - baixadas(item), [baixadas]);
  const [periodo, setPeriodo] = useState<"vencidas" | "hoje" | "amanha" | "todos" | "personalizado">("todos");
  const [inicio, setInicio] = useState(periodoInicial.de);
  const [fim, setFim] = useState(periodoInicial.ate);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [conservacao, setConservacao] = useState("");
  const [status, setStatus] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [visualizacao, setVisualizacao] = useState<"grade" | "lista">("grade");
  const [ordem, setOrdem] = useState("validade");
  const [modoBaixa, setModoBaixa] = useState(false);
  const [erroBaixa, setErroBaixa] = useState("");
  const [selecionado, setSelecionado] = useState<ItemValidade | null>(null);


  const categorias = Array.from(new Set(dados.itens.map((item) => item.categoriaNome).filter((item): item is string => Boolean(item)))).sort();
  const corresponde = useCallback((item: ItemValidade, alterar: Partial<{ periodo: typeof periodo; categoria: string; conservacao: string; status: string }> = {}) => {
    const filtros = { periodo, categoria, conservacao, status, ...alterar };
    const data = dataLocal(item.validoAte, item.fusoHorario);
    const hojeLocal = dataLocal(dados.agora, item.fusoHorario);
    const amanhaLocal = deslocarData(new Date(`${hojeLocal}T12:00:00Z`), 1);
    const dataPeriodo = filtros.periodo === "amanha" ? amanhaLocal : hojeLocal;
    const vencida = new Date(item.validoAte).getTime() < new Date(dados.agora).getTime();
    const correspondePeriodo = filtros.periodo === "todos" || (filtros.periodo === "vencidas" ? vencida : filtros.periodo === "personalizado" ? data >= inicio && data <= fim : data === dataPeriodo && !vencida);
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (estado === "todas" || (estado === "ativas" ? restantes(item) > 0 : baixadas(item) > 0)) && correspondePeriodo
      && (!termo || (item.produtoNome + " " + (item.lote || "")).toLocaleLowerCase("pt-BR").includes(termo))
      && (!filtros.categoria || item.categoriaNome === filtros.categoria)
      && (!filtros.conservacao || item.conservacao === filtros.conservacao)
      && (!filtros.status || item.status === filtros.status);
  }, [periodo, inicio, fim, busca, categoria, conservacao, status, dados.agora, estado, restantes, baixadas]);
  const contagemFiltro = (alterar: Parameters<typeof corresponde>[1]) =>
    dados.itens.filter(item => corresponde(item, alterar)).length.toLocaleString("pt-BR");
  const contagem = (periodo: "vencidas" | "hoje" | "amanha") =>
    dados.itens.filter(item => corresponde(item, { periodo })).reduce((total, item) => total + (estado === "baixadas" ? baixadas(item) : restantes(item)), 0);
  const filtrados = useMemo(() => [...dados.itens.filter(item => corresponde(item))].sort((a,b) => ordem === "nome" ? a.produtoNome.localeCompare(b.produtoNome,"pt-BR") : (ordem === "recentes" ? Date.parse(b.manipuladoEm)-Date.parse(a.manipuladoEm) : Date.parse(a.validoAte)-Date.parse(b.validoAte)) || a.id.localeCompare(b.id)), [dados.itens, corresponde, ordem]);
  // A identidade do cadastro agrupa o produto; cada snapshot conserva lote, prazo e responsável.
  // Sem vínculo com o cadastro, o registro fica separado para não unir homônimos.
  const grupos = new Map<string, ItemValidade[]>();
  for (const item of filtrados) {
    const chave = item.insumoId ? `produto:${item.insumoId}` : `registro:${item.id}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  const totalEtiquetas = filtrados.reduce((total, item) => total + (estado === "baixadas" ? baixadas(item) : restantes(item)), 0);
  const periodos = [
    { id: "vencidas" as const, nome: "Vencidas",  quantidade: contagem("vencidas"), cor: "text-destructive", icone: TriangleAlert, descricao: "Todos os prazos vencidos" },
    { id: "hoje" as const, nome: "Vencem hoje",  quantidade: contagem("hoje"), cor: "text-warning", icone: CalendarClock, descricao: "Confira antes do vencimento" },
    { id: "amanha" as const, nome: "Vencem amanhã",  quantidade: contagem("amanha"), cor: "text-success", icone: PackageCheck, descricao: "Prepare a próxima operação" },
  ];

  function estadoPrazo(item: ItemValidade) {
    if (Date.parse(item.validoAte) < Date.parse(dados.agora)) return { nome: "Vencida", tom: "critico" };
    const dia = dataLocal(item.validoAte, item.fusoHorario), hoje = dataLocal(dados.agora, item.fusoHorario);
    if (dia === hoje) return { nome: "Vence hoje", tom: "alerta" };
    if (dia === deslocarData(new Date(`${hoje}T12:00:00Z`),1)) return { nome: "Vence amanhã", tom: "preventivo" };
    return { nome: "Em dia", tom: "neutro" };
  }
  function abrir(item: ItemValidade, baixa = false) {
    setSelecionado(item); setModoBaixa(baixa); setErroBaixa(""); setQuantidadeBaixa("1"); setConfirmarBaixa(false); chaveBaixa.current = crypto.randomUUID();
  }
  function registrarBaixa(item: ItemValidade, quantidade: number, chave: string) {
    if (travaBaixa.current || !podeBaixar || quantidade < 1 || quantidade > restantes(item)) return;
    travaBaixa.current = true;
    setRegistrandoId(item.id); setErroBaixa("");
    iniciar(async () => {
      try {
        const resultado = await baixarEtiquetaAction({ trabalhoId: item.id, quantidade, chaveIdempotencia: chave });
        if ("erro" in resultado) { setErroBaixa(resultado.erro); toast.error(resultado.erro); return; }
        setBaixasLocais(atual => ({ ...atual, [item.id]: baixadas(item) + quantidade }));
        setSelecionado(null); roteador.refresh(); toast.success("Baixa registrada.");
      } catch {
        const mensagem = "Não foi possível confirmar a baixa. Tente novamente; a solicitação será preservada.";
        setErroBaixa(mensagem); toast.error(mensagem);
      } finally { travaBaixa.current = false; setRegistrandoId(null); }
    });
  }
  function solicitarBaixa(item: ItemValidade) {
    if (restantes(item) !== 1) { abrir(item, true); return; }
    let chave = chavesDiretas.current.get(item.id);
    if (!chave) { chave = crypto.randomUUID(); chavesDiretas.current.set(item.id, chave); }
    registrarBaixa(item, 1, chave);
  }
  const formatar = (data: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone:fuso, dateStyle:"short", timeStyle:"short" }).format(new Date(data));
  const totalPeriodo = dados.itens.filter(i=>corresponde(i,{periodo:"todos"})).reduce((n,i)=>n+(estado === "baixadas" ? baixadas(i) : restantes(i)),0);
  return <div className="space-y-4">
    <section className="validades-indicadores" aria-label="Resumo de validades">{periodos.map((item, indice) => <Button key={item.id} variant="ghost" className="validades-indicador" data-tom={["critico","alerta","preventivo"][indice]} aria-label={item.nome} aria-pressed={periodo===item.id} onClick={()=>setPeriodo(item.id)}>
      <span className="validades-icone-indicador"><item.icone aria-hidden="true" /></span><span className="validades-indicador-textos"><strong>{item.nome}</strong><span><b className="text-stat tabular-nums">{item.quantidade}</b> <span className="text-sm text-muted-foreground">etiqueta(s)</span></span></span><ChevronRight className="validades-seta" aria-hidden="true" />
    </Button>)}</section>
    <Card className="validades-filtros"><CardContent className="space-y-3">
      <div className="validades-filtros-principais"><CampoBusca containerClassName="min-w-0" aria-label="Buscar produto ou lote" placeholder="Buscar produto, ingrediente ou lote…" value={busca} onChange={setBusca} /><Button variant={periodo==="todos"?"secondary":"outline"} aria-pressed={periodo==="todos"} onClick={()=>setPeriodo("todos")}>Todas <span className="hidden tabular-nums sm:inline">{totalPeriodo}</span></Button><Button size="icon" className="sm:w-auto sm:gap-2 sm:px-5" variant="outline" aria-label="Filtros" aria-expanded={mostrarFiltros} onClick={()=>setMostrarFiltros(!mostrarFiltros)}><Filter /><span className="hidden sm:inline">Filtros</span></Button>
        <GrupoAcoes nome="Visualização das validades"><Button size="icon" className="lg:w-auto lg:gap-2 lg:px-5" variant={visualizacao==="grade"?"secondary":"ghost"} aria-label="Grade" aria-pressed={visualizacao==="grade"} onClick={()=>setVisualizacao("grade")}><LayoutGrid /><span className="hidden lg:inline">Grade</span></Button><Button size="icon" className="lg:w-auto lg:gap-2 lg:px-5" variant={visualizacao==="lista"?"secondary":"ghost"} aria-label="Lista" aria-pressed={visualizacao==="lista"} onClick={()=>setVisualizacao("lista")}><List /><span className="hidden lg:inline">Lista</span></Button></GrupoAcoes>

      </div>
      {mostrarFiltros && <div className="grid gap-4 border-t pt-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1"><Label htmlFor={`${id}-ordem`}>Ordenar etiquetas</Label><SelecaoFormulario id={`${id}-ordem`} value={ordem} onValueChange={setOrdem}><option value="validade">Validade mais próxima</option><option value="nome">Nome do produto</option><option value="recentes">Manipulação mais recente</option></SelecaoFormulario></div>
        <div className="space-y-1"><Label htmlFor={`${id}-periodo`}>Período</Label><SelecaoFormulario id={`${id}-periodo`} value={periodo} onValueChange={v=>setPeriodo(v as typeof periodo)}><option value="todos">Todos ({contagemFiltro({periodo:"todos"})})</option><option value="vencidas">Vencidas ({contagemFiltro({periodo:"vencidas"})})</option><option value="hoje">Vencem hoje ({contagemFiltro({periodo:"hoje"})})</option><option value="amanha">Vencem amanhã ({contagemFiltro({periodo:"amanha"})})</option><option value="personalizado">Personalizado ({contagemFiltro({periodo:"personalizado"})})</option></SelecaoFormulario></div>
        <div className="space-y-1"><Label htmlFor={`${id}-grupo`}>Grupo</Label><SelecaoFormulario id={`${id}-grupo`} value={categoria} onValueChange={setCategoria}><option value="">Todos ({contagemFiltro({categoria:""})})</option>{categorias.map(c=><option key={c} value={c}>{c} ({contagemFiltro({categoria:c})})</option>)}</SelecaoFormulario></div>
        <div className="space-y-1"><Label htmlFor={`${id}-conservacao`}>Conservação</Label><SelecaoFormulario id={`${id}-conservacao`} value={conservacao} onValueChange={setConservacao}><option value="">Todas ({contagemFiltro({conservacao:""})})</option>{["SECO","REFRIGERADO","CONGELADO","APOS_ABERTO"].map(c=><option key={c} value={c}>{rotuloConservacaoEtiqueta(c as ConservacaoEtiquetaValor)} ({contagemFiltro({conservacao:c})})</option>)}</SelecaoFormulario></div>
        <div className="space-y-1"><Label htmlFor={`${id}-acompanhamento`}>Acompanhamento</Label><SelecaoFormulario id={`${id}-acompanhamento`} value={estado} onValueChange={setEstado}><option value="ativas">Etiquetas em acompanhamento</option><option value="baixadas">Baixas registradas</option><option value="todas">Todas, incluindo baixadas</option></SelecaoFormulario></div>
        <div className="space-y-1"><Label htmlFor={`${id}-status`}>Status da impressão</Label><SelecaoFormulario id={`${id}-status`} value={status} onValueChange={setStatus}><option value="">Todos ({contagemFiltro({status:""})})</option>{["CONFIRMADO_PELO_OPERADOR","ENVIADO_AO_DISPOSITIVO","EXPORTADO","PREPARADO"].map((v,i)=><option key={v} value={v}>{["Confirmada","Enviada","Exportada","Preparada"][i]} ({contagemFiltro({status:v})})</option>)}</SelecaoFormulario></div>
        {periodo==="personalizado"&&<><div className="space-y-1"><Label htmlFor={`${id}-inicio`}>De</Label><Input id={`${id}-inicio`} type="date" value={inicio} onChange={e=>setInicio(e.target.value)} /></div><div className="space-y-1"><Label htmlFor={`${id}-fim`}>Até</Label><Input id={`${id}-fim`} type="date" value={fim} min={inicio} onChange={e=>setFim(e.target.value)} /></div></>}
      </div>}
    </CardContent></Card>
    <section aria-labelledby={`${id}-monitoria`} className="space-y-3"><header className="flex flex-wrap items-center justify-between gap-2"><div><h2 id={`${id}-monitoria`} className="text-title">Monitoria de validades</h2><p className="text-sm text-muted-foreground">{totalEtiquetas} etiqueta(s) · {grupos.size} produto(s)</p></div><div className="flex flex-wrap items-center gap-3">{acoes}</div></header>
      {erroBaixa&&!selecionado&&<p role="alert" className="text-sm text-destructive">{erroBaixa}</p>}
      {filtrados.length===0?<Card><CardContent className="py-10 text-center text-muted-foreground"><PackageCheck className="mx-auto mb-3 size-8" /><p>Nenhuma etiqueta corresponde aos filtros.</p></CardContent></Card>:<div className={`validades-grade ${visualizacao==="lista"?"validades-em-lista":""}`}>{[...grupos].map(([chave,itens])=>{
        const ativos=itens.filter(item=>restantes(item)>0);
        const proximos=[...(ativos.length?ativos:itens)].sort((a,b)=>Date.parse(a.validoAte)-Date.parse(b.validoAte));
        const item=proximos[0], situacao=estadoPrazo(item), aberto=Boolean(gruposAbertos[chave]), agrupado=itens.length>1;
        const quantidade=itens.reduce((n,i)=>n+(estado==="baixadas"?baixadas(i):restantes(i)),0);
        const conservacoes=[...new Set(itens.map(i=>rotuloConservacaoEtiqueta(i.conservacao)))].join(" · ");
        const regiao=`${id}-grupo-${encodeURIComponent(chave)}`;
        const expandir=()=>setGruposAbertos(atual=>({...atual,[chave]:!atual[chave]}));
        const unica=ativos.length===1&&restantes(ativos[0])===1?ativos[0]:null;
        return <Card key={chave} className="validades-etiqueta" aria-busy={pendente&&itens.some(i=>i.id===registrandoId)}><CardContent>
          <div className="validades-resumo-grupo">
            <Button variant="ghost" className="validades-abrir-slot" aria-label={agrupado?`${aberto?"Recolher":"Ver"} etiquetas de ${item.produtoNome}`:`Ver etiqueta de ${item.produtoNome} ${item.id.slice(-6)}`} aria-expanded={agrupado?aberto:undefined} aria-controls={agrupado?regiao:undefined} disabled={pendente} onClick={()=>agrupado?expandir():abrir(item)}><span className="sr-only">{agrupado?"Ver etiquetas":"Ver etiqueta"}</span></Button>
            <div className="validades-etiqueta-conteudo"><FotoProduto url={item.fotoUrl} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-semibold leading-snug">{item.produtoNome}</h3><p className="mt-1 text-xs text-muted-foreground">{item.categoriaNome||"Sem categoria"} · {conservacoes}</p></div><span className="validades-copias">{quantidade}×</span></div><span className="validades-chip mt-2" data-tom={situacao.tom}>{situacao.tom==="critico"?<TriangleAlert />:<CalendarDays />}{situacao.nome}</span><p className="mt-2 flex items-center gap-2 text-xs"><CalendarClock className="size-4 shrink-0 text-muted-foreground" />{agrupado?"Próxima: ":""}{formatar(item.validoAte,item.fusoHorario)}</p><p className="mt-1 text-xs text-muted-foreground">{agrupado?`${itens.length} registros · datas e lotes no detalhe`:item.responsavelManipulacao}</p></div></div>
            <div className="validades-etiqueta-acoes"><span className="flex items-center gap-2 text-xs text-muted-foreground"><Tag className="size-4" /> {agrupado?aberto?"Recolher etiquetas":"Ver etiquetas":"Ver etiqueta"}{agrupado?<ChevronDown className={`ml-auto size-4 ${aberto?"rotate-180":""}`} />:<ChevronRight className="ml-auto size-4" />}</span>{podeBaixar&&ativos.length>0&&<Button variant="outline" aria-label={`Dar baixa em ${item.produtoNome}${agrupado?"":` ${item.id.slice(-6)}`}`} disabled={pendente} onClick={()=>unica?solicitarBaixa(unica):agrupado?setGruposAbertos(atual=>({...atual,[chave]:true})):solicitarBaixa(item)}><Archive />{registrandoId&&(unica?.id===registrandoId||!agrupado&&item.id===registrandoId)?"Registrando…":"Dar baixa"}</Button>}</div>
          </div>
          {agrupado&&aberto&&<div id={regiao} role="region" aria-label={`Etiquetas de ${item.produtoNome}`} className="validades-registros">{itens.map(registro=><div key={registro.id} className="validades-registro"><div className="min-w-0"><span className="validades-chip" data-tom={estadoPrazo(registro).tom}>{estadoPrazo(registro).nome}</span><p className="mt-2 text-sm font-medium">{formatar(registro.validoAte,registro.fusoHorario)} · {restantes(registro)} em acompanhamento</p><p className="mt-1 text-xs text-muted-foreground">{rotuloConservacaoEtiqueta(registro.conservacao)} · {registro.responsavelManipulacao}</p><p className="mt-1 text-xs text-muted-foreground">Lote: {registro.lote||"não informado"} · #{registro.id.slice(-6).toUpperCase()}{baixadas(registro)>0?` · ${baixadas(registro)} baixa(s)`:""}</p></div><GrupoAcoes nome={`Ações do registro ${registro.id.slice(-6)}`}><Button variant="ghost" aria-label={`Ver etiqueta de ${registro.produtoNome} ${registro.id.slice(-6)}`} disabled={pendente} onClick={()=>abrir(registro)}><Tag />Ver etiqueta</Button>{podeBaixar&&restantes(registro)>0&&<Button variant="outline" aria-label={`Dar baixa na etiqueta ${registro.id.slice(-6)} de ${registro.produtoNome}`} disabled={pendente} onClick={()=>solicitarBaixa(registro)}><Archive />{registrandoId===registro.id?"Registrando…":"Dar baixa"}</Button>}</GrupoAcoes></div>)}</div>}
        </CardContent></Card>;
      })}</div>}
      <p className="text-xs text-muted-foreground">A baixa retira as etiquetas do acompanhamento e preserva o histórico. Ela não movimenta estoque nem registra consumo ou descarte.</p>
    </section>
    <Dialog open={Boolean(selecionado)} onOpenChange={aberto=>!aberto&&!pendente&&setSelecionado(null)} protegerAlteracoes={false}>{selecionado&&<DialogContent className="validades-detalhe max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><div className="mb-2"><span className="validades-chip" data-tom={estadoPrazo(selecionado).tom}>{estadoPrazo(selecionado).nome}</span></div><DialogTitle className="text-2xl">{selecionado.produtoNome}</DialogTitle><DialogDescription>Registro da etiqueta · #{selecionado.id.slice(-6).toUpperCase()}</DialogDescription></DialogHeader>
      <div className="validades-detalhe-grade"><div className="validades-papel"><EtiquetaPreview dados={selecionado.dados} /></div><dl className="validades-dados-etiqueta">{[["Responsável",selecionado.responsavelManipulacao],["Grupo",selecionado.categoriaNome||"Sem categoria"],["Produto",selecionado.produtoNome],["Conservação",rotuloConservacaoEtiqueta(selecionado.conservacao)],["Manipulação",formatar(selecionado.manipuladoEm,selecionado.fusoHorario)],["Validade",formatar(selecionado.validoAte,selecionado.fusoHorario)],["Quantidade",selecionado.dados.quantidade?`${selecionado.dados.quantidade} ${selecionado.dados.unidade}`:"Não informada"],["Lote",selecionado.lote||"Não informado"],["Etiquetas associadas",`${restantes(selecionado)} em acompanhamento · ${baixadas(selecionado)} baixada(s)`],["Saída física",selecionado.confirmado?"Confirmada pelo operador":"Ainda não confirmada"]].map(([nome,valor])=><div key={nome}><dt>{nome}</dt><dd>{valor}</dd></div>)}</dl></div>
      {podeBaixar && restantes(selecionado) > 0 && modoBaixa && <section className="validades-baixa space-y-3" aria-label="Baixa de etiquetas"><h3 className="flex items-center gap-2 font-semibold"><Archive className="size-4" /> Dar baixa</h3><p className="text-sm text-muted-foreground">Informe quantas etiquetas não existem mais. Essa ação preserva o histórico.</p><div className="max-w-xs space-y-1"><Label htmlFor={`${id}-quantidade-baixa`}>Quantidade de etiquetas</Label><Input id={`${id}-quantidade-baixa`} autoFocus inputMode="numeric" restricao="inteiro" min={1} maxLength={6} value={quantidadeBaixa} disabled={pendente} onChange={e => { setQuantidadeBaixa(e.target.value); setErroBaixa(""); setConfirmarBaixa(false); chaveBaixa.current = crypto.randomUUID(); }} /></div>{confirmarBaixa && <p role="status" className="text-sm font-medium">Confirma a baixa de {quantidadeBaixa} etiqueta(s) de {selecionado.produtoNome}?</p>}{erroBaixa && <p role="alert" className="text-sm text-destructive">{erroBaixa}</p>}<GrupoAcoes nome="Baixa da etiqueta" className="flex-wrap">{confirmarBaixa && <Button variant="outline" disabled={pendente} onClick={() => setConfirmarBaixa(false)}>Cancelar</Button>}<Button variant="entrada" disabled={pendente || !Number.isInteger(Number(quantidadeBaixa)) || Number(quantidadeBaixa) < 1 || Number(quantidadeBaixa) > restantes(selecionado)} onClick={() => { if (!confirmarBaixa) { setConfirmarBaixa(true); return; } registrarBaixa(selecionado, Number(quantidadeBaixa), chaveBaixa.current); }}>{pendente ? "Registrando…" : confirmarBaixa ? "Confirmar baixa" : "Dar baixa"}</Button></GrupoAcoes></section>}
      {erroBaixa&&!modoBaixa&&<p role="alert" className="text-sm text-destructive">{erroBaixa}</p>}
      <footer className="validades-detalhe-acoes"><Link className={buttonVariants({variant:"outline"})} href={`${caminhoBase}?aba=historico`}>Histórico e reimpressão</Link><GrupoAcoes nome="Ações da etiqueta"><DialogClose render={<Button variant="outline" disabled={pendente} />}>Fechar</DialogClose>{podeBaixar&&restantes(selecionado)>0&&!modoBaixa&&<Button variant="entrada" disabled={pendente} onClick={()=>solicitarBaixa(selecionado)}><Archive /> {registrandoId===selecionado.id?"Registrando…":"Dar baixa"}</Button>}</GrupoAcoes></footer>
    </DialogContent>}</Dialog>
  </div>;
}
