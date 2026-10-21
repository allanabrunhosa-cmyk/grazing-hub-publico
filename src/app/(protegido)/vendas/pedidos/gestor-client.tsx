"use client";

import { lazy, Suspense, useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bike, CalendarDays, CheckCheck, ChefHat, ChevronLeft, ChevronRight, ClipboardList, FileText, History, Loader2, MoreHorizontal, Package, PackageCheck, Plus, Printer, RefreshCw, Settings2, ShoppingBag, Truck, X } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { TagCanalVenda } from "@/components/tag-canal-venda";
import { FiltroCanalVenda } from "@/components/filtro-canal-venda";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SeletorVisualizacaoOperacional } from "@/components/seletor-visualizacao-operacional";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { imprimir } from "./quadros";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { diaNoFuso, somarDias } from "@/lib/vendas/pedidos-agenda-dominio";
import { estadosOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import type { listarPedidos } from "@/lib/vendas/pedidos";
import type { ConfiguracaoMovimentacaoEstoqueGestor } from "@/lib/vendas/pedidos-operacao-dominio";
import { mudarStatusGestorPedidoAction } from "./gestor-actions";
import { ConfigurarEstoqueGestor } from "./configurar-estoque-gestor";
import { colunasGestor, dataPedidoGestor, etapaDoPedido, horaPedidoGestor, instantePedidoGestor, modoGestor, nomeStatusGestor, rotaGestor, type GestorFiltros, type ModoGestor } from "./gestor-dominio";
import { rotaPopupPedido } from "./pedidos-navegacao";
import { navegarComPedidoAberto } from "./modal-pedido";
import { MiniaturasPedido } from "./miniaturas-pedido";
import "./gestor.css";

const ResumoPedido = lazy(() => import("./resumo-pedido").then(modulo => ({ default: modulo.ResumoPedido })));

type Resultado = Awaited<ReturnType<typeof listarPedidos>>;
export type PedidoGestor = Resultado["pedidos"][number];
type Opcao = { id: string; nome: string };
export type GestorProps = { resultado: Resultado; filtros: GestorFiltros; clientes: Opcao[]; canais: Opcao[]; produtos: Opcao[]; capacidades: { adicionar: boolean; preparar: boolean; expedir: boolean; cancelar?: boolean }; configurarIfood?: boolean; configuracaoEstoque?: ConfiguracaoMovimentacaoEstoqueGestor; agenda: { inicio: string; fim: string; dias: string[]; dia: string; visao: string; fuso: string }; caminhoBase: string };
const moeda = (s: string) => Number(s).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCivil = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const dataEntrega = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const destinos: Record<string, string> = { PENDENTE: "Em preparo", EM_PREPARO: "Pronto", PRONTO: "Em rota", EM_ENTREGA: "Entregues" };
const anteriores: Record<string, string> = { PRONTO: "Em preparo", EM_ENTREGA: "Pronto", ENTREGUE: "Em rota" };
const icones = [ClipboardList, ChefHat, PackageCheck, Truck, CheckCheck];

function FiltroSelect({ nome, valor, mudar, opcoes }: { nome: string; valor: string; mudar: (v: string) => void; opcoes: Opcao[] }) {
  return <label className="grid min-w-0 gap-1 text-sm"><span>{nome}</span><Select value={valor} onValueChange={v => mudar(v ?? "")} items={Object.fromEntries(opcoes.map(o => [o.id, o.nome]))}><SelectTrigger className="w-full" aria-label={nome}><SelectValue /></SelectTrigger><SelectContent alignItemWithTrigger={false}>{opcoes.map(o => <SelectItem key={o.id} value={o.id} quebrarTexto>{o.nome}</SelectItem>)}</SelectContent></Select></label>;
}
function StatusPedido({ p }: { p: PedidoGestor }) {
  return <span className="gestor-status" data-status={p.status} data-etapa={etapaDoPedido(p.status, p.operacional)?.id}><Badge className="gestor-status-rotulo" variant={p.status === "RASCUNHO" ? "warning" : "outline"}>{nomeStatusGestor(p.status, p.operacional)}</Badge></span>;
}
function enderecoFotografado(endereco: Record<string, string> | null | undefined) { return Object.entries(endereco ?? {}).filter(([k, v]) => k !== "nome" && v).map(([, v]) => v).join(", ") || "—"; }
function enderecoPedido(p: PedidoGestor) { return enderecoFotografado(p.enderecoSnapshot); }
function resumoPedido(p: PedidoGestor) { return { id: p.id, numero: p.numero, versao: p.versao, atendimento: p.atendimento, referenciaPedido: p.referenciaPedido, status: p.status, etapa: p.operacional, comprador: p.cliente, anteriores: p.pedidosAnteriores, data: p.dataGestor, janela: p.previsaoJanela, inicioPreparo: p.inicioPreparoIfood ? new Date(p.inicioPreparoIfood).toLocaleString("pt-BR", { timeZone: p.fusoHorario }) : null, endereco: enderecoPedido(p), destinatario: p.destinatarioSnapshot?.nome && p.destinatarioSnapshot.nome.trim().toLocaleLowerCase() !== p.cliente.trim().toLocaleLowerCase() ? p.destinatarioSnapshot.nome : null, observacoes: p.observacoes ?? "", itens: p.itensDetalhes.map(i => ({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade, escolhas: i.complementos, observacoes: i.observacoes ?? "" })) }; }

export function GestorPedidos(props: GestorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pedidoSelecionado = pathname?.startsWith(`${props.caminhoBase}/`) ? pathname.slice(props.caminhoBase.length + 1).split("/")[0] : null;
  const [visualizacao, setVisualizacao] = useState({ base: props.filtros, valor: modoGestor(props.filtros.modo), pendente: false });
  if (visualizacao.base !== props.filtros) {
    const modoServidor = modoGestor(props.filtros.modo);
    const pendente = visualizacao.pendente && visualizacao.valor !== modoServidor;
    setVisualizacao({ base: props.filtros, valor: pendente ? visualizacao.valor : modoServidor, pendente });
  }
  const statusSeparado = ["RASCUNHO", "CANCELADO", "DECLINADO", "ESTORNADO"].includes(props.filtros.status ?? "") || props.filtros.operacional === "INTERROMPIDO";
  const modo = props.filtros.status === "HISTORICO" || statusSeparado && visualizacao.valor === "quadros" ? "lista" : visualizacao.valor;
  const [canal, setCanal] = useState({ base: props.filtros, valor: props.filtros.canalId, pendente: false });
  if (canal.base !== props.filtros) {
    const pendente = canal.pendente && canal.valor !== props.filtros.canalId;
    setCanal({ base: props.filtros, valor: pendente ? canal.valor : props.filtros.canalId, pendente });
  }
  const [consulta, setConsulta] = useState({ base: props.filtros, valor: props.filtros.busca ?? "", pendente: false, agendar: false });
  const [compondo, setCompondo] = useState(false);
  // Respostas intermediárias não devem apagar o texto que ainda está sendo digitado.
  if (consulta.base !== props.filtros) {
    const buscaServidor = props.filtros.busca ?? "";
    const pendente = consulta.pendente && consulta.valor.trim() !== buscaServidor;
    setConsulta({ base: props.filtros, valor: pendente ? consulta.valor : buscaServidor, pendente, agendar: pendente && consulta.agendar });
  }
  const [navegando, navegar] = useTransition();
  const [dadosLocais, setDadosLocais] = useState({ base: props.resultado, pedidos: props.resultado.pedidos });
  if (dadosLocais.base !== props.resultado) setDadosLocais({ base: props.resultado, pedidos: props.resultado.pedidos });
  const pedidos = dadosLocais.base === props.resultado ? dadosLocais.pedidos : props.resultado.pedidos;
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState("");
  const [pedidoCalendario, setPedidoCalendario] = useState<string | null>(null);
  const [documento, setDocumento] = useState<PedidoGestor | null>(null);
  const documentoAposCalendario = useRef<PedidoGestor | null>(null);
  const destinoAposCalendario = useRef<string | null>(null);
  const travas = useRef(new Set<string>()), chaves = useRef<Record<string, string>>({});
  const { capacidades, agenda, resultado, configurarIfood = false } = props;
  const substituir = router.replace;
  const retorno = rotaGestor({ ...props.filtros, canalId: canal.valor }, { modo, busca: consulta.valor.trim() || undefined });
  const rotaBusca = rotaGestor({ ...props.filtros, canalId: canal.valor }, { busca: consulta.valor.trim() || undefined, modo, pagina: undefined });
  useEffect(() => {
    if (!consulta.agendar || compondo) return;
    const temporizador = setTimeout(() => { setConsulta(v => ({ ...v, agendar: false })); if (!navegarComPedidoAberto(rotaBusca)) navegar(() => substituir(rotaBusca, { scroll: false })); }, 300);
    return () => clearTimeout(temporizador);
  }, [consulta.agendar, consulta.valor, compondo, rotaBusca, substituir]);
  function mudarBusca(valor: string) { const pendente = valor.trim() !== (props.filtros.busca ?? ""); setConsulta({ base: props.filtros, valor, pendente, agendar: pendente }); }
  function ir(alteracoes: GestorFiltros = {}, base = props.filtros) {
    const busca = "busca" in alteracoes ? alteracoes.busca : consulta.valor.trim() || undefined;
    const canalId = "canalId" in alteracoes ? alteracoes.canalId : canal.valor;
    const destino = rotaGestor({ ...base, busca, canalId, modo }, alteracoes);
    if (navegarComPedidoAberto(destino)) return false;
    if ("canalId" in alteracoes) setCanal({ base: props.filtros, valor: canalId, pendente: canalId !== props.filtros.canalId });
    setConsulta({ base: props.filtros, valor: busca ?? "", pendente: (busca ?? "") !== (props.filtros.busca ?? ""), agendar: false });
    navegar(() => router.push(destino, { scroll: false }));
    return true;
  }
  function mudarModo(v: ModoGestor) { if (ir({ modo: v, ...(v === "quadros" && statusSeparado ? { status: "operacionais", etapaGestor: undefined, operacional: undefined } : {}), pagina: undefined })) setVisualizacao({ base: props.filtros, valor: v, pendente: v !== modoGestor(props.filtros.modo) }); }
  function seguirLink(e: MouseEvent<HTMLAnchorElement>, destino: string) { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0 && navegarComPedidoAberto(destino)) e.preventDefault(); }
  const rotulos: Partial<Record<keyof GestorFiltros, string>> = { busca: "Busca", clienteId: "Cliente", canalId: "Canal", produtoId: "Produto", status: "Situação", etapaGestor: "Status", operacional: "Etapa operacional", de: "De", ate: "Até" };
  function valorFiltro(chave: keyof GestorFiltros, valor: string) {
    const opcoes = chave === "clienteId" ? props.clientes : chave === "canalId" ? props.canais : chave === "produtoId" ? props.produtos : [];
    return opcoes.find(o => o.id === valor)?.nome ?? (chave === "operacional" ? (estadosOperacao as Record<string, string>)[valor] : chave === "etapaGestor" ? colunasGestor.find(c => c.id === valor)?.nome : chave === "status" ? ({ todos: "Todas", CONFIRMADO: "Confirmado", RASCUNHO: "Em orçamento", DECLINADO: "Declinado", ESTORNADO: "Estornado", CANCELADO: "Cancelado", HISTORICO: "Histórico" } as Record<string, string>)[valor] : valor) ?? valor;
  }
  async function alterar(p: PedidoGestor, direcao: "avancar" | "voltar") {
    if (travas.current.has(p.id)) return;
    travas.current.add(p.id); setSalvando(v => ({ ...v, [p.id]: true })); setErros(v => ({ ...v, [p.id]: "" })); setMensagem("");
    const assinatura = `${p.id}:${p.versao}:${direcao}`, chave = chaves.current[assinatura] ??= crypto.randomUUID();
    try {
      const r = await mudarStatusGestorPedidoAction(p.id, p.versao, direcao, chave);
      if ("erro" in r) setErros(v => ({ ...v, [p.id]: r.erro ?? "Não foi possível confirmar o status." }));
      else { setDadosLocais(v => ({ ...v, pedidos: v.pedidos.map(item => item.id === p.id ? { ...item, versao: r.versao, operacional: r.statusOperacional } : item) })); setMensagem(`Pedido #${p.numero}: ${nomeStatusGestor(p.status, r.statusOperacional)}.`); router.refresh(); }
    } catch { setErros(v => ({ ...v, [p.id]: "Resultado não confirmado. Atualize os pedidos antes de repetir." })); }
    finally { travas.current.delete(p.id); setSalvando(v => ({ ...v, [p.id]: false })); }
  }
  function proximoPasso(p: PedidoGestor) {
    const ativo = !p.acompanhamentoIfood && p.origem !== "IFOOD" && p.status === "CONFIRMADO" && etapaDoPedido(p.status, p.operacional);
    const avancar = ativo && destinos[p.operacional] && (p.operacional === "PENDENTE" || p.operacional === "EM_PREPARO" ? capacidades.preparar : capacidades.expedir);
    if (!avancar) return null;
    const labelAvancar = p.atendimento === "RETIRADA" && p.operacional === "PRONTO" ? `Registrar retirada do pedido #${p.numero}` : p.operacional === "PENDENTE" ? `Iniciar preparo do pedido #${p.numero}` : `Avançar pedido #${p.numero} para ${destinos[p.operacional]}`;
    return <Button size="icon-sm" data-acao-gestor="" aria-label={labelAvancar} title={labelAvancar} disabled={salvando[p.id]} aria-busy={salvando[p.id] || undefined} onClick={() => void alterar(p, "avancar")}>{salvando[p.id] ? <Loader2 className="animate-spin" /> : p.operacional === "PENDENTE" ? <ChefHat /> : p.operacional === "EM_PREPARO" ? <Package /> : p.operacional === "PRONTO" && p.atendimento !== "RETIRADA" ? <Truck /> : <CheckCheck />}</Button>;
  }
  function abrirResumo(p: PedidoGestor, cancelar = false) {
    const destino = rotaPopupPedido(`${props.caminhoBase}/${p.id}${cancelar ? "?cancelar=1" : ""}`, retorno);
    if (pedidoCalendario === p.id) {
      destinoAposCalendario.current = destino;
      setPedidoCalendario(null);
    } else if (!navegarComPedidoAberto(destino)) router.push(destino);
  }
  function abrirLinkPedido(e: MouseEvent<HTMLAnchorElement>, p: PedidoGestor) {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); abrirResumo(p); }
  }
  function erro(p: PedidoGestor) { return erros[p.id] ? <div className="mt-2 space-y-1"><p role="alert" className="whitespace-normal text-xs text-destructive">{erros[p.id]}</p><Button variant="link" size="sm" onClick={() => abrirResumo(p)} aria-label={`Ver pendência do pedido #${p.numero}`}>Ver pendência</Button></div> : null; }
  function imprimirProducao(p: PedidoGestor) { if (p.acompanhamentoIfood) return; setMensagem(imprimir(resumoPedido(p)) ? "Impressão de produção solicitada; confira o resultado na impressora." : "Permita a janela de impressão."); }
  function abrirDocumento(p: PedidoGestor) {
    if (pedidoCalendario === p.id) { documentoAposCalendario.current = p; setPedidoCalendario(null); }
    else setDocumento(p);
  }
  function consultar(p: PedidoGestor) {
    if (p.origem === "HISTORICO_LEGADO") return <Button variant="outline" size="icon-sm" aria-label={`Ver pedido histórico #${p.numero}`} title="Ver pedido histórico" onClick={() => abrirResumo(p)}><History /></Button>;
    const descricaoCancelamento = p.operacional === "ENTREGUE" ? "Pedido entregue. Retorne a uma etapa anterior para cancelar." : salvando[p.id] ? "Aguarde a atualização do pedido para cancelar." : "";
    const descricaoId = `bloqueio-cancelamento-gestor-${p.id}`;
    return <GrupoAcoes nome={`Ações do pedido #${p.numero}`} className="gestor-consulta">
    <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" data-acao-gestor="" />} aria-label={`Mais ações do pedido #${p.numero}`} title="Mais ações"><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-56">
      {!p.acompanhamentoIfood && p.origem !== "IFOOD" && p.status === "CONFIRMADO" && anteriores[p.operacional] && capacidades.expedir && <DropdownMenuItem disabled={salvando[p.id]} onClick={() => void alterar(p, "voltar")} aria-label={`Retornar pedido #${p.numero} para ${p.atendimento === "RETIRADA" && p.operacional === "ENTREGUE" ? "Pronto" : anteriores[p.operacional]}`}><ArrowLeft />Retornar para {p.atendimento === "RETIRADA" && p.operacional === "ENTREGUE" ? "Pronto" : anteriores[p.operacional]}</DropdownMenuItem>}
      <DropdownMenuItem onClick={() => abrirDocumento(p)}><FileText />Resumo do pedido</DropdownMenuItem>
      {capacidades.cancelar && p.status === "CONFIRMADO" && p.origem !== "IFOOD" && !p.acompanhamentoIfood && <><DropdownMenuSeparator /><DropdownMenuItem disabled={!!descricaoCancelamento} aria-label="Cancelar pedido" aria-describedby={descricaoCancelamento ? descricaoId : undefined} onClick={() => { if (!descricaoCancelamento) abrirResumo(p, true); }} className="pedido-detalhe-menu-cancelar"><X /><span>Cancelar pedido{descricaoCancelamento && <span id={descricaoId} className="mt-1 block max-w-56 whitespace-normal text-xs font-normal text-muted-foreground">{descricaoCancelamento}</span>}</span></DropdownMenuItem></>}
    </DropdownMenuContent></DropdownMenu>
  </GrupoAcoes>; }
  function acoesPrincipais(p: PedidoGestor) { return <GrupoAcoes nome={`Fluxo e documentos do pedido #${p.numero}`} className="gestor-cartao-acoes">{proximoPasso(p)}{!p.acompanhamentoIfood && (p.status === "RASCUNHO" || p.status === "CONFIRMADO") && <Button variant="outline" size="icon-sm" data-acao-gestor="" aria-label={`Imprimir produção do pedido #${p.numero}`} title="Impressão de produção" onClick={() => imprimirProducao(p)}><Printer /></Button>}{consultar(p)}</GrupoAcoes>; }
  function valorPedido(p: PedidoGestor) { return p.status === "RASCUNHO" ? <span className="text-muted-foreground">Em orçamento</span> : moeda(p.total); }
  function cartao(p: PedidoGestor, compacto = false) {
    const etapa = etapaDoPedido(p.status, p.operacional);
    return compacto ? <article key={p.id} className="gestor-status gestor-evento" data-status={p.status} data-etapa={etapa?.id} aria-label={`Pedido #${p.numero}`}>
      <Popover open={pedidoCalendario === p.id} onOpenChange={aberto => setPedidoCalendario(aberto ? p.id : null)} onOpenChangeComplete={aberto => {
        if (!aberto && documentoAposCalendario.current) { setDocumento(documentoAposCalendario.current); documentoAposCalendario.current = null; }
        if (!aberto && destinoAposCalendario.current) {
          const destino = destinoAposCalendario.current;
          if (!navegarComPedidoAberto(destino)) router.push(destino);
          destinoAposCalendario.current = null;
        }
      }}>
        <PopoverTrigger render={<Button variant="ghost" className="h-auto w-full flex-col items-stretch gap-0.5 p-0 text-left whitespace-normal" />} aria-label={`Expandir pedido #${p.numero}`}>
          <span className="flex min-w-0 items-baseline gap-1"><span className="shrink-0 tabular-nums">#{p.numero}</span><span className="min-w-0 truncate text-sm" title={p.cliente}>{p.cliente}</span></span>
          <span className="flex min-w-0 items-center justify-between gap-1"><span className="min-w-0 whitespace-normal text-xs font-normal tabular-nums">{p.previsaoJanela ?? "Sem horário"}</span><TagCanalVenda canal={p.acompanhamentoIfood ? "Acompanhamento — Takeat" : p.origem === "IFOOD" ? "iFood" : p.canal} /></span>
        </PopoverTrigger>
        <PopoverContent className="gestor-pedidos w-80 p-0" aria-label={`Detalhes do pedido #${p.numero}`}>
          {cartao(p)}
        </PopoverContent>
      </Popover>
    </article> : <Card key={p.id} size="sm" className="gestor-status gestor-cartao shrink-0" data-status={p.status} data-etapa={etapa?.id} data-selecionado={pedidoSelecionado === p.id || undefined} aria-label={`Pedido #${p.numero}`}>
      <Link className="gestor-cartao-conteudo" aria-label={`#${p.numero}`} href={rotaPopupPedido(`${props.caminhoBase}/${p.id}`, retorno)} onClick={e => abrirLinkPedido(e, p)}>
        <div className="gestor-cartao-topo"><strong className="gestor-numero">#{p.numero}</strong></div>
        <div className="gestor-cartao-cliente"><p className="gestor-cliente" title={p.cliente}>{p.cliente}</p>{resumoPedido(p).destinatario && <p className="gestor-destinatario" title={`Para: ${resumoPedido(p).destinatario}`}>Para: {resumoPedido(p).destinatario}</p>}</div>
        <p className="gestor-cartao-agenda"><CalendarDays aria-hidden /><span>{p.dataGestor ? dataEntrega(p.dataGestor) : "Sem data"}{p.previsaoJanela ? ` · ${p.previsaoJanela}` : " · Sem horário"}</span></p>
        <div className="gestor-cartao-tipo"><span>{p.atendimento === "RETIRADA" ? <ShoppingBag /> : <Bike />}{p.atendimento === "RETIRADA" ? "Retirada" : p.atendimento === "LOCAL" ? "No local" : "Entrega"}</span><span>{p.itens} {p.itens === 1 ? "item" : "itens"}</span></div>
        <div className="gestor-cartao-produtos"><MiniaturasPedido itens={p.itensDetalhes} numero={p.numero} /><strong className="gestor-cartao-valor">{valorPedido(p)}</strong></div>
        {p.acompanhamentoIfood && <TagCanalVenda canal="Acompanhamento — Takeat" />}
      </Link>
      <div className="gestor-cartao-menu">{acoesPrincipais(p)}</div>
      {erro(p)}
    </Card>;
  }
  const semData = pedidos.filter(p => !p.dataGestor);
  const deslocamento = (new Date(`${agenda.inicio}T12:00:00Z`).getUTCDay() + 6) % 7;
  const legenda = <div className="flex flex-wrap gap-2" aria-label="Legenda dos status">{colunasGestor.map(c => <span key={c.id} className="gestor-status" data-etapa={c.id}><Badge variant="outline" className="gestor-status-rotulo">{c.nome}</Badge></span>)}</div>;
  const filtrosVisiveis = { ...props.filtros, canalId: canal.valor };
  const filtroStatusOperacional = !!filtrosVisiveis.etapaGestor && ["CONFIRMADO", "operacionais"].includes(filtrosVisiveis.status ?? "");
  const filtrosAtivos = Object.entries(rotulos).filter(([chave]) => filtrosVisiveis[chave as keyof GestorFiltros] && !(chave === "status" && (["todos", "operacionais"].includes(filtrosVisiveis.status ?? "") || filtroStatusOperacional)));
  const contagensStatus = resultado.contagensStatus;
  const statusSelecionado = filtrosVisiveis.status === "RASCUNHO" ? "orcamento" : filtrosVisiveis.status === "CANCELADO" ? "cancelado" : filtrosVisiveis.status === "DECLINADO" ? "declinado" : filtrosVisiveis.status === "ESTORNADO" ? "estornado" : filtrosVisiveis.operacional === "INTERROMPIDO" ? "interrompido" : filtrosVisiveis.etapaGestor ?? "todos";
  function filtrarStatus(valor: string) {
    ir({ etapaGestor: colunasGestor.some(c => c.id === valor) ? valor : undefined, status: valor === "orcamento" ? "RASCUNHO" : valor === "cancelado" ? "CANCELADO" : "operacionais", ...(valor === "orcamento" || valor === "cancelado" ? { modo: "lista" } : {}), operacional: undefined, pagina: undefined });
  }
  return <div className="gestor-pedidos space-y-3" aria-busy={navegando || undefined}>
    <div className="gestor-cabecalho">
      <BarraAcoes titulo="Pedidos" descricao={props.filtros.status === "HISTORICO" ? "Consulte os pedidos históricos. Os dados são somente leitura." : "Acompanhe e gerencie os pedidos em tempo real."} className="gestor-barra">
        <div className="gestor-consulta-principal"><SeletorVisualizacaoOperacional valor={modo} aoMudar={mudarModo} className="gestor-visualizacao" />
        <CampoBusca formato="arredondado" aria-label="Buscar pedidos" placeholder="Buscar por número, cliente ou item…" maxLength={160} value={consulta.valor} onChange={mudarBusca} onCompositionStart={() => setCompondo(true)} onCompositionEnd={() => setCompondo(false)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); setConsulta(v => ({ ...v, agendar: false })); if (!navegarComPedidoAberto(rotaBusca)) navegar(() => substituir(rotaBusca, { scroll: false })); } }} containerClassName="gestor-busca" />
        </div><FiltroCanalVenda contagens={props.resultado.contagensCanal} canais={props.canais} canalId={canal.valor} aoMudar={canalId => ir({ canalId, pagina: undefined })} />
        <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="icon" />} aria-label="Mais opções de pedidos" title="Mais opções"><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={() => filtrarStatus("orcamento")}><FileText />Orçamentos ({resultado.contagensStatus?.orcamento ?? 0})</DropdownMenuItem>
          <DropdownMenuItem onClick={() => filtrarStatus("cancelado")}>Cancelados ({resultado.contagensStatus?.cancelado ?? 0})</DropdownMenuItem>
          <DropdownMenuItem onClick={() => ir({ modo: "lista", status: "HISTORICO", etapaGestor: undefined, operacional: undefined, baseData: "criacao", pagina: undefined })}><History />Pedidos históricos</DropdownMenuItem>
          <DropdownMenuItem onClick={() => ir({ modo: "lista", status: "DECLINADO", etapaGestor: undefined, operacional: undefined, pagina: undefined })}>Declinados</DropdownMenuItem>
          <DropdownMenuItem onClick={() => ir({ modo: "lista", status: "ESTORNADO", etapaGestor: undefined, operacional: undefined, pagina: undefined })}>Estornados</DropdownMenuItem>
          <DropdownMenuItem onClick={() => ir({ modo: "lista", status: "CONFIRMADO", etapaGestor: undefined, operacional: "INTERROMPIDO", pagina: undefined })}>Interrompidos</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { const destino = rotaPopupPedido(`${props.caminhoBase}/gestao`, retorno); if (!navegarComPedidoAberto(destino)) router.push(destino); }}><History />Histórico e gestão</DropdownMenuItem>
          {configurarIfood && <DropdownMenuItem onClick={() => { const destino = "/vendas/pedidos/ifood"; if (!navegarComPedidoAberto(destino)) router.push(destino); }}><Settings2 />Configurar iFood</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => router.refresh()}><RefreshCw />Atualizar pedidos</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
        {props.configuracaoEstoque && <ConfigurarEstoqueGestor configuracao={props.configuracaoEstoque} />}
        {capacidades.adicionar && <Button className="gestor-novo" nativeButton={false} render={<Link onClick={e => seguirLink(e, rotaPopupPedido(`${props.caminhoBase}/novo`, retorno))} href={rotaPopupPedido(`${props.caminhoBase}/novo`, retorno)} />}><Plus />Novo pedido</Button>}
      </BarraAcoes>
    </div>
      {contagensStatus && props.filtros.status !== "HISTORICO" && <FiltroOpcoesContadas nome="Status dos pedidos" valor={statusSelecionado} onValueChange={filtrarStatus} className="gestor-filtros-status" opcoes={[
        { valor: "todos", nome: "Todos", quantidade: contagensStatus.todos },
        ...colunasGestor.map(c => ({ valor: c.id, nome: c.nome, quantidade: contagensStatus[c.id] })),
        { valor: "cancelado", nome: "Cancelado", quantidade: contagensStatus.cancelado },
      ]} />}
      {!!filtrosAtivos.length && <div className="flex flex-wrap items-center gap-2">{filtrosAtivos.map(([chave, nome]) => { const valor = filtrosVisiveis[chave as keyof GestorFiltros]!; return <Badge key={chave} variant="outline" className="h-auto gap-1 overflow-visible bg-card/80 py-0 pr-0 pl-3.5 font-semibold shadow-xs"><span>{nome}: {valorFiltro(chave as keyof GestorFiltros, valor)}</span><Button type="button" variant="excluir" aria-label={`Remover filtro ${nome}`} onClick={() => ir(chave === "etapaGestor" && filtroStatusOperacional ? { status: undefined, etapaGestor: undefined, operacional: undefined, pagina: undefined } : { [chave]: undefined, pagina: undefined })} /></Badge>; })}</div>}
      {navegando && <p role="status" className="text-sm text-muted-foreground">Carregando pedidos…</p>}{mensagem && <p role="status" className="text-sm text-success">{mensagem}</p>}
      {!pedidos.length && <p role="status" className="rounded-[var(--ds-cartao-raio)] border bg-card p-6 text-sm text-muted-foreground">Nenhum pedido corresponde aos filtros.</p>}
      {modo === "quadros" && <section aria-label="Quadros de pedidos"><div className="gestor-quadros-rolagem"><div className="gestor-quadros">{colunasGestor.map((c, n) => {
        const nesta = pedidos.filter(p => etapaDoPedido(p.status, p.operacional)?.id === c.id).sort((a, b) => instantePedidoGestor(b).localeCompare(instantePedidoGestor(a)));
        const Icone = icones[n];
        const subtitulos = ["Aguardando confirmação", "Na cozinha", "Entrega ou retirada", "Saiu para entrega", "Pedido finalizado"];
        return <section key={c.id} className="gestor-coluna" data-etapa={c.id} aria-label={c.nome}><header className="gestor-coluna-cabecalho"><Icone aria-hidden="true" /><div><h2 aria-label={c.nome}>{c.id === "pronto" ? "Pronto para entrega" : c.nome}</h2><p>{subtitulos[n]}</p></div><Badge variant="outline">{nesta.length}</Badge></header>{nesta.length ? <div className="gestor-coluna-pedidos">{nesta.map(p => cartao(p))}</div> : <div className="gestor-coluna-vazia"><Icone className="mx-auto mb-3 size-8 opacity-60" /><p className="text-sm">{c.vazio}</p></div>}</section>;
      })}</div></div></section>}
      {modo === "calendario" && <section aria-label="Calendário de pedidos"><div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <GrupoAcoes nome="Período do calendário"><Button variant="outline" size="icon-sm" data-acao-gestor="" aria-label="Período anterior" onClick={() => ir({ modo: "calendario", data: somarDias(agenda.inicio, -1), pagina: undefined })}><ChevronLeft /></Button><Button variant="outline" size="sm" onClick={() => ir({ modo: "calendario", data: diaNoFuso(new Date(), agenda.fuso), pagina: undefined })}>Hoje</Button><Button variant="outline" size="icon-sm" data-acao-gestor="" aria-label="Próximo período" onClick={() => ir({ modo: "calendario", data: somarDias(agenda.fim, 1), pagina: undefined })}><ChevronRight /></Button></GrupoAcoes>
        <p className="text-sm font-medium">{dataCivil(agenda.inicio)} – {dataCivil(agenda.fim)} · {agenda.inicio.slice(0, 4)}</p>
        <FiltroSelect nome="Período" valor={agenda.visao} mudar={v => ir({ modo: "calendario", visao: v, pagina: undefined })} opcoes={[{ id: "mes", nome: "Mês" }, { id: "semana", nome: "Semana" }, { id: "dia", nome: "Dia" }]} />
      </div><div className="mb-3">{legenda}</div><div className="gestor-calendario-rolagem"><div className={agenda.visao === "dia" ? "grid gap-3" : "gestor-calendario"}>
        {agenda.visao !== "dia" && ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(s => <div key={s} className="gestor-dia !min-h-0 text-center text-xs font-medium">{s}</div>)}
        {agenda.visao === "mes" && Array.from({ length: deslocamento }, (_, n) => <div key={`vazio-${n}`} aria-hidden="true" className="gestor-dia gestor-dia-vazio" />)}
        {agenda.dias.map(d => <section key={d} aria-label={`Pedidos de ${dataCivil(d)}`} className="gestor-dia"><header className="mb-2 flex flex-wrap items-center justify-between gap-1"><h2 className="text-xs font-semibold">{dataCivil(d)}</h2>{capacidades.adicionar && <Button variant="ghost" size="icon-sm" data-acao-gestor="" nativeButton={false} aria-label={`Agendar pedido em ${dataCivil(d)}`} render={<Link onClick={e => seguirLink(e, rotaPopupPedido(`${props.caminhoBase}/novo?data=${d}`, retorno))} href={rotaPopupPedido(`${props.caminhoBase}/novo?data=${d}`, retorno)} />}><Plus /></Button>}</header><div className="gestor-dia-pedidos">{pedidos.filter(p => p.dataGestor === d).map(p => cartao(p, true))}</div></section>)}
        {agenda.visao === "mes" && Array.from({ length: (7 - (agenda.dias.length + deslocamento) % 7) % 7 }, (_, n) => <div key={`vazio-final-${n}`} aria-hidden="true" className="gestor-dia gestor-dia-vazio" />)}
      </div></div><p className="mt-2 text-xs text-muted-foreground">Datas no fuso {agenda.fuso}. {resultado.paginas > 1 ? "A contagem e os pedidos do calendário correspondem à página atual." : ""}</p>{semData.length > 0 && <section className="mt-4 space-y-3"><h2 className="font-semibold">Pedidos sem data de entrega</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{semData.map(p => cartao(p))}</div></section>}</section>}
      {modo === "lista" && <section aria-label="Lista de pedidos"><div className="gestor-painel-lista rounded-[var(--ds-cartao-raio)] border bg-card"><Table className="gestor-lista"><TableHeader><TableRow>{["Pedido", "Criação", "Cliente", "Canal", "Itens", "Entrega / retirada", "Total", "Status", "Ações"].map(t => <TableHead key={t} className={t === "Total" ? "text-right" : undefined}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>{pedidos.map(p => <TableRow key={p.id} className="gestor-status" data-status={p.status} data-etapa={etapaDoPedido(p.status, p.operacional)?.id} data-selecionado={pedidoSelecionado === p.id || undefined} onClick={e => { if (!(e.target as HTMLElement).closest("button,a,[role=menuitem]")) abrirResumo(p); }}>
          <TableCell><div className="gestor-lista-identificador"><Link className="gestor-numero text-title font-semibold hover:text-primary hover:underline" onClick={e => abrirLinkPedido(e, p)} href={rotaPopupPedido(`${props.caminhoBase}/${p.id}`, retorno)}>#{p.numero}</Link>{p.referenciaPedido && <span className="gestor-referencia text-xs text-muted-foreground" title={p.referenciaPedido}>{p.referenciaPedido}</span>}</div></TableCell>
          <TableCell className="tabular-nums"><span className="font-medium">{dataPedidoGestor(instantePedidoGestor(p), p.fusoHorario)}</span><p className="text-xs text-muted-foreground">{horaPedidoGestor(instantePedidoGestor(p), p.fusoHorario)}</p></TableCell>
          <TableCell className="gestor-texto-coluna"><p className="font-semibold">{p.cliente}</p>{resumoPedido(p).destinatario && <p className="text-xs text-muted-foreground">Para: {resumoPedido(p).destinatario}</p>}<p className="text-xs text-muted-foreground">{p.origem === "HISTORICO_LEGADO" ? "Modalidade não comprovada" : p.atendimento === "RETIRADA" ? "Retirada" : p.atendimento === "LOCAL" ? "No local" : "Entrega"}</p></TableCell>
          <TableCell><TagCanalVenda canal={p.acompanhamentoIfood ? "Acompanhamento — Takeat" : p.origem === "IFOOD" ? "iFood" : p.canal} /></TableCell>
          <TableCell className="gestor-texto-coluna"><div className="gestor-itens-lista"><MiniaturasPedido itens={p.itensDetalhes} numero={p.numero} /><span className="text-xs text-muted-foreground">{p.itens} {p.itens === 1 ? "item" : "itens"}</span></div></TableCell>
          <TableCell className="tabular-nums"><span className="font-medium">{p.dataGestor ? dataEntrega(p.dataGestor) : "Sem data"}</span><p className="text-xs text-muted-foreground">{p.previsaoJanela ?? "Sem horário"}</p></TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{valorPedido(p)}</TableCell>
          <TableCell><StatusPedido p={p} /></TableCell>
          <TableCell>{acoesPrincipais(p)}{erro(p)}</TableCell>
        </TableRow>)}</TableBody></Table></div></section>}
      {documento && <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Preparando pré-visualização…</p>}><ResumoPedido pedido={documento} fechar={() => setDocumento(null)} /></Suspense>}

    {resultado.paginas > 1 && <nav aria-label="Páginas de pedidos" className="flex flex-wrap items-center justify-end gap-3"><Button variant="outline" size="sm" disabled={resultado.pagina <= 1 || navegando} onClick={() => ir({ modo, pagina: String(resultado.pagina - 1) })}>Anterior</Button><span className="text-sm">Página {resultado.pagina} de {resultado.paginas}</span><Button variant="outline" size="sm" disabled={resultado.pagina >= resultado.paginas || navegando} onClick={() => ir({ modo, pagina: String(resultado.pagina + 1) })}>Próxima</Button></nav>}
  </div>;
}
