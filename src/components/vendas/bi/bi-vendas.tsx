"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, CircleHelp, Download, FileText, Filter, MapPin, RefreshCw, ShoppingCart, Tag, Truck, Users } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SelecaoFormulario, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTableHead, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AbaBi, FiltrosBi, IndicadoresBi, OpcaoBi, ResultadoBi, SerieBi } from "@/lib/vendas/bi-types";
import { HOST_PEDIDOS } from "@/lib/hosts";
import { GraficoClientes } from "./bi-clientes-grafico";
import { RankingCategorias } from "./bi-categorias";
import { MapaCalorEntregas } from "./bi-mapa";
import s from "./bi-vendas.module.css";

const moeda = (v: number | null) => v === null ? "Não apurado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const numero = (v: number | null) => v === null ? "Não apurado" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(v);
const percentual = (v: number | null) => v === null ? "Não apurado" : `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`;
const data = (v: string | null) => v ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(v.length === 10 ? `${v}T12:00:00-03:00` : v)) : "Não informada";
const compacto = (v: number | null, dinheiro = false) => v === null ? "Não apurado" : dinheiro ? `${v < 0 ? "−" : ""}R$ ${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(v))}` : new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const ABAS: [AbaBi, string][] = [["geral", "Visão geral"], ["produtos", "Produtos"], ["clientes", "Clientes"], ["entregas", "Entregas"], ["rentabilidade", "Rentabilidade"]];
const CHAVE_FILTROS = "grazing:bi-vendas:filtros:v1";
type Consulta = (filtros: FiltrosBi) => Promise<ResultadoBi | { erro: string }>;
type Painel = "filtros" | "cobertura" | "pedidos" | null;

export function parametrosBi(filtros: FiltrosBi) {
  const parametros = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => { if ((valor !== "" || chave === "de" || chave === "ate") && valor !== undefined) parametros.set(chave, String(valor)); });
  return parametros.toString();
}

function Seletor({ nome, valor, opcoes, alterar, todos, compacto = false, className = "" }: { nome: string; valor: string; opcoes: OpcaoBi[]; alterar: (v: string) => void; todos?: string; compacto?: boolean; className?: string }) {
  if (compacto) return <Select value={valor} onValueChange={v => { if (v) alterar(v); }}><SelectTrigger aria-label={nome} size="sm"><SelectValue>{opcoes.find(o => o.id === valor)?.nome}</SelectValue></SelectTrigger><SelectContent>{opcoes.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select>;
  return <SelecaoFormulario aria-label={nome} value={valor} onValueChange={alterar} className={`${s.seletor} ${className}`}>{todos && <option value="">{nome} · {todos}</option>}{opcoes.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</SelecaoFormulario>;
}

function SeletorCliente({ valor, opcoes, alterar }: { valor: string; opcoes: OpcaoBi[]; alterar: (valor: string) => void }) {
  const normalizarBusca = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
  return <div className="flex min-w-0 items-center gap-2">
    <Combobox items={opcoes} value={opcoes.find(opcao => opcao.id === valor) ?? null} itemToStringLabel={opcao => opcao.nome} isItemEqualToValue={(opcao, selecionado) => opcao.id === selecionado.id} filter={(opcao, consulta) => normalizarBusca(opcao.nome).includes(normalizarBusca(consulta))} onValueChange={opcao => alterar(opcao?.id ?? "")}>
      <ComboboxInputGroup className="min-w-0 flex-1"><ComboboxInput aria-label="Cliente comprador" placeholder="Buscar cliente pelo nome" maxLength={200} /></ComboboxInputGroup>
      <ComboboxContent emptyLabel="Nenhum cliente encontrado.">{(opcao: OpcaoBi) => <ComboboxItem key={opcao.id} value={opcao}>{opcao.nome}</ComboboxItem>}</ComboboxContent>
    </Combobox>
    {valor && <BotaoRemoverItem discreto nome="Limpar filtro de cliente" onClick={() => alterar("")} />}
  </div>;
}

function Bloco({ titulo, descricao, acoes, children, className = "" }: { titulo: string; descricao?: string; acoes?: ReactNode; children: ReactNode; className?: string }) {
  return <Card size="sm" className={`${s.bloco} ${className}`}><div className={s.blocoCabecalho}><div className="min-w-0"><h2 className={s.blocoTitulo}>{titulo}</h2>{descricao && <p className={s.blocoDescricao}>{descricao}</p>}</div>{acoes}</div>{children}</Card>;
}

function Alternador<T extends string>({ nome, valor, opcoes, alterar }: { nome: string; valor: T; opcoes: [T, string][]; alterar: (v: T) => void }) {
  return <GrupoAcoes nome={nome} className={s.alternador}>{opcoes.map(([id, rotulo]) => <Button formato="campo" key={id} size="sm" variant={valor === id ? "default" : "ghost"} aria-pressed={valor === id} onClick={() => alterar(id)}>{rotulo}</Button>)}</GrupoAcoes>;
}

function ValoresGrafico({ serie, selecionar }: { serie: SerieBi[]; selecionar: (item: SerieBi) => void }) {
  const [aberto, definirAberto] = useState(false);
  return <Popover open={aberto} onOpenChange={definirAberto}>
    <PopoverTrigger render={<Button formato="campo" variant="ghost" size="icon-sm" aria-label="Consultar valores do gráfico" title="Consultar valores do gráfico" />}><FileText aria-hidden="true" /></PopoverTrigger>
    <PopoverContent align="end" className="w-[36rem]">
      <PopoverTitle>Valores da evolução</PopoverTitle>
      <PopoverDescription className="mt-1">Valores exatos. Selecione um período para consultar os pedidos.</PopoverDescription>
      <Table><TableHeader><TableRow><TableHead>Período</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead>Cobertura</TableHead></TableRow></TableHeader><TableBody>{serie.map(item => <TableRow key={item.de}><TableCell><Button formato="campo" variant="link" size="sm" onClick={() => { definirAberto(false); selecionar(item); }}>{item.rotulo}</Button></TableCell><TableCell className="text-right">{moeda(item.vendas)}</TableCell><TableCell className="text-right">{numero(item.pedidos)}</TableCell><TableCell>{item.parcial ? "Parcial" : item.coberto ? "Disponível" : "Sem cobertura"}</TableCell></TableRow>)}</TableBody></Table>
      {!serie.length && <p className="mt-3 text-xs text-muted-foreground">Nenhum período disponível nesta seleção.</p>}
    </PopoverContent>
  </Popover>;
}

function GraficoVendas({ serie, metrica, comparar, selecionar }: { serie: SerieBi[]; metrica: FiltrosBi["metrica"]; comparar: boolean; selecionar: (item: SerieBi) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const margemEsquerda = useRef(68);
  const [destacado, definirDestacado] = useState<number | null>(null);
  const atual = destacado === null ? null : serie[destacado];
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    function desenhar() {
      const ctx = canvas!.getContext("2d"); if (!ctx) return;
      const { width, height } = canvas!.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = Math.round(width * dpr); canvas!.height = Math.round(height * dpr); ctx.scale(dpr, dpr);
      const css = getComputedStyle(canvas!); const cor = (token: string) => css.getPropertyValue(token).trim();
      const primaria = cor("--primary"); const borda = cor("--border"); const texto = cor("--muted-foreground"); const fg = cor("--foreground");
      const right = 8; const top = 22; const bottom = 30; const gh = height - top - bottom;
      const valores = serie.flatMap(item => [item[metrica] ?? 0, comparar ? item[metrica === "vendas" ? "anteriorVendas" : "anteriorPedidos"] ?? 0 : 0]);
      const maximo = Math.max(...valores, 1); const minimo = Math.min(...valores, 0); const amplitude = maximo - minimo; const escala = (v: number) => top + gh - ((v - minimo) / amplitude) * gh;
      ctx.font = "11px " + css.fontFamily; ctx.textBaseline = "middle";
      const larguraRotulos = Math.max(...Array.from({ length: 5 }, (_, i) => ctx.measureText(compacto(minimo + amplitude * i / 4, metrica === "vendas")).width));
      const left = Math.ceil(Math.max(width < 450 ? 54 : 68, larguraRotulos + 12));
      margemEsquerda.current = left;
      const gw = width - left - right;
      for (let i = 0; i <= 4; i++) {
        const valor = minimo + amplitude * i / 4; const y = escala(valor);
        ctx.strokeStyle = borda; ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = texto; ctx.textAlign = "right"; ctx.fillText(compacto(valor, metrica === "vendas"), left - 10, y);
      }
      const passo = gw / Math.max(serie.length, 1); const largura = Math.max(1, Math.min(58, passo * (comparar ? .34 : .7))); const labelCada = Math.max(1, Math.ceil(serie.length / (width < 400 ? 5 : 12)));
      const valorCada = width < 450 ? Math.max(labelCada, Math.ceil(serie.length / Math.max(1, Math.floor(gw / 65)))) : 1;
      const barras: { x: number; y: number; largura: number; altura: number }[] = [];
      const anotacoes: { texto: string; x: number; y: number; largura: number; negrito: boolean }[] = [];
      serie.forEach((item, i) => {
        const centro = left + passo * i + passo / 2; const valor = item[metrica]; const anterior = item[metrica === "vendas" ? "anteriorVendas" : "anteriorPedidos"];
        if (!item.coberto || valor === null) { ctx.fillStyle = texto; ctx.globalAlpha = .45; ctx.fillText("—", centro, top + gh / 2); ctx.globalAlpha = 1; }
        else {
          if (comparar && anterior !== null) { ctx.globalAlpha = .24; ctx.fillStyle = primaria; const y = escala(anterior); const barra = { x: centro - largura - 1, y: Math.min(y, escala(0)), largura, altura: Math.max(1, Math.abs(escala(0) - y)) }; ctx.fillRect(barra.x, barra.y, barra.largura, barra.altura); barras.push(barra); ctx.globalAlpha = 1; }
          ctx.fillStyle = primaria; ctx.globalAlpha = i === destacado || i === serie.length - 1 ? 1 : .65;
          const y = escala(valor); const barra = { x: comparar ? centro + 1 : centro - largura / 2, y: Math.min(y, escala(0)), largura, altura: Math.max(1, Math.abs(escala(0) - y)) }; ctx.fillRect(barra.x, barra.y, barra.largura, barra.altura); barras.push(barra); ctx.globalAlpha = 1;
          if (serie.length <= 12 && valor !== 0 && (i % valorCada === 0 || i === serie.length - 1)) { ctx.font = (i === serie.length - 1 ? "600 " : "") + "11px " + css.fontFamily; const textoValor = compacto(valor); const metadeTexto = ctx.measureText(textoValor).width / 2; const xTexto = width < 450 ? Math.max(left + metadeTexto + 4, Math.min(width - right - metadeTexto, centro)) : centro; anotacoes.push({ texto: textoValor, x: xTexto, y: Math.max(10, y - 10), largura: metadeTexto * 2, negrito: i === serie.length - 1 }); }
        }
        if (i % labelCada === 0 || i === serie.length - 1) { ctx.font = "11px " + css.fontFamily; ctx.fillStyle = texto; ctx.textAlign = "center"; ctx.fillText(item.rotulo, centro, height - 12, passo * labelCada - 2); }
      });
      for (const anotacao of anotacoes) {
        const colide = width < 450 && barras.some(barra => anotacao.x + anotacao.largura / 2 > barra.x && anotacao.x - anotacao.largura / 2 < barra.x + barra.largura && anotacao.y + 3 > barra.y && anotacao.y - 11 < barra.y + barra.altura);
        if (colide) continue;
        ctx.font = (anotacao.negrito ? "600 " : "") + "11px " + css.fontFamily; ctx.textAlign = "center"; ctx.fillStyle = fg; ctx.fillText(anotacao.texto, anotacao.x, anotacao.y);
      }
    }
    desenhar(); const observer = new ResizeObserver(desenhar); observer.observe(canvas);
    return () => observer.disconnect();
  }, [serie, metrica, comparar, destacado]);
  function indice(x: number) { const canvas = ref.current!; const left = margemEsquerda.current; return Math.max(0, Math.min(serie.length - 1, Math.floor((x - left) / ((canvas.clientWidth - left - 8) / serie.length)))); }
  if (!serie.length) return <div className={s.vazio}>Nenhum período disponível para esta seleção.</div>;
  return <div className={s.grafico}><canvas ref={ref} tabIndex={0} role="img" aria-label={`Evolução de ${metrica === "vendas" ? "faturamento" : "pedidos"}. Use as setas para consultar os períodos e Enter para ver os pedidos. Valores exatos em Consultar valores do gráfico no cabeçalho.`} onMouseMove={e => definirDestacado(indice(e.clientX - e.currentTarget.getBoundingClientRect().left))} onMouseLeave={() => definirDestacado(null)} onClick={e => selecionar(serie[indice(e.clientX - e.currentTarget.getBoundingClientRect().left)])} onFocus={() => definirDestacado(0)} onBlur={() => definirDestacado(null)} onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); definirDestacado(Math.max(0, Math.min(serie.length - 1, (destacado ?? 0) + (e.key === "ArrowRight" ? 1 : -1)))); } if (e.key === "Enter" && atual) { e.preventDefault(); selecionar(atual); } }} />{atual && <div className={s.tooltipGrafico} role="status"><strong>{data(atual.de)} a {data(atual.ate)}</strong>{atual.parcial && <p>Cobertura parcial do intervalo.</p>}<p>{atual.coberto ? metrica === "vendas" ? moeda(atual.vendas) : `${numero(atual.pedidos)} pedidos` : "Sem cobertura confirmada"}</p>{comparar && <p>Comparação: {metrica === "vendas" ? moeda(atual.anteriorVendas) : numero(atual.anteriorPedidos)}</p>}</div>}</div>;
}

function Paginacao({ pagina, paginas, total, alterar }: { pagina: number; paginas: number; total: number; alterar: (p: number) => void }) {
  return <div className={s.paginacao}><span>{numero(total)} registros · Página {pagina} de {Math.max(1, paginas)}</span><GrupoAcoes nome="Paginação"><Button formato="campo" variant="outline" size="sm" disabled={pagina <= 1} onClick={() => alterar(pagina - 1)}>Anterior</Button><Button formato="campo" variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => alterar(pagina + 1)}>Próxima</Button></GrupoAcoes></div>;
}

function ColunaOrdenavel<T extends string>({ coluna, ordem, direcao, alterar, children }: { coluna: T; ordem: T; direcao: "asc" | "desc"; alterar: (coluna: T) => void; children: ReactNode }) {
  return <SortableTableHead active={ordem === coluna} direction={direcao} onClick={() => alterar(coluna)}>{children}</SortableTableHead>;
}

export function BiVendas({ dados: inicial, consultar, usuarioId = "sessao", chaveMapa }: { dados: ResultadoBi; consultar?: Consulta; usuarioId?: string; chaveMapa?: string }) {
  const [metricaClientes, definirMetricaClientes] = useState<"pedidos" | "faturamento">("pedidos");
  const [dados, definirDados] = useState(inicial); const [filtros, definirFiltros] = useState(inicial.filtros);
  const [carregando, definirCarregando] = useState(false); const [erro, definirErro] = useState("");
  const [painel, definirPainel] = useState<Painel>(null); const [rascunho, definirRascunho] = useState(inicial.filtros);
  const sequencia = useRef(0); const filtrosRef = useRef(filtros); const ultimaTentativa = useRef(filtros); const confirmados = useRef(filtros); const iniciou = useRef(false);
  async function aplicar(alteracao: Partial<FiltrosBi>, preservarPagina = false) {
    const novos = { ...filtrosRef.current, ...alteracao, ...(preservarPagina ? {} : { pagina: 1 }) };
    filtrosRef.current = novos; ultimaTentativa.current = novos; definirErro("");
    const id = ++sequencia.current; definirCarregando(true);
    try {
      if (!consultar) throw new Error("Consulta indisponível. Atualize a página para tentar novamente.");
      const resposta = await consultar(novos); if (id !== sequencia.current) return;
      if ("erro" in resposta) { filtrosRef.current = confirmados.current; definirErro(resposta.erro); return; }
      definirDados(resposta); definirFiltros(resposta.filtros); filtrosRef.current = resposta.filtros; confirmados.current = resposta.filtros;
      const parametros = parametrosBi(resposta.filtros);
      window.history.replaceState(null, "", `${location.pathname}?${parametros}`);
      try { localStorage.setItem(`${CHAVE_FILTROS}:${usuarioId}`, JSON.stringify(resposta.filtros)); } catch { /* Preferência local opcional. */ }
    } catch (e) { if (id === sequencia.current) { filtrosRef.current = confirmados.current; definirErro(e instanceof Error ? e.message : "Não foi possível consultar os indicadores. Tente novamente."); } }
    finally { if (id === sequencia.current) definirCarregando(false); }
  }
  useEffect(() => {
    if (iniciou.current) return; iniciou.current = true;
    if (location.search) return;
    try { const salvo = localStorage.getItem(`${CHAVE_FILTROS}:${usuarioId}`); if (salvo) { const valor = JSON.parse(salvo) as Partial<FiltrosBi>; if (typeof valor.de === "string" && typeof valor.ate === "string") queueMicrotask(() => { void aplicar({ ...valor, baseData: "pedido" }); }); } } catch { /* Preferência inválida usa o padrão do servidor. */ }
    // A restauração ocorre uma vez. O servidor valida o filtro armazenado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const c = dados.cobertura; const periodo = `${data(dados.periodoEfetivo.de)} — ${data(dados.periodoEfetivo.ate)}`;
  const indicadores: { chave: keyof IndicadoresBi; titulo: string; descricao: string; ajuda: string; icone: typeof ShoppingCart; formato: (v: number | null) => string }[] = [
    { chave: "vendas", titulo: "Faturamento", descricao: "Após descontos · Com frete", ajuda: "Valor líquido comercial dos produtos mais o frete cobrado. O ranking de produtos não recebe rateio de frete. Descontos já incorporados não são descontados novamente. Devoluções aplicáveis são tratadas uma única vez. Parcelas sem itens são preservadas em Sem detalhamento.", icone: ShoppingCart, formato: moeda },
    { chave: "descontos", titulo: "Descontos", descricao: "Conforme os registros disponíveis", ajuda: "Descontos comerciais identificados na fonte. Não são deduzidos novamente do faturamento. Ausência de informação não equivale a desconto zero.", icone: Tag, formato: moeda },
    { chave: "pedidos", titulo: "Pedidos", descricao: "Sem orçamentos e cancelados", ajuda: "Pedidos distintos da base comercial válida. Pedidos com devolução parcial continuam na contagem e têm seu valor comercial ajustado. Valor zero, por si só, não significa cancelamento.", icone: FileText, formato: numero },
    { chave: "ticket", titulo: "Ticket médio", descricao: "Faturamento por pedido", ajuda: "Faturamento dividido pelos mesmos pedidos. Não apurado quando não há pedidos.", icone: BarChart3, formato: moeda },
    { chave: "compradores", titulo: "Clientes compradores", descricao: "Clientes únicos no período", ajuda: `Compradores identificados, sem usar o destinatário do presente nem unir pessoas pelo nome. ${numero(c.pedidosSemCliente)} pedidos estão sem cliente identificável.`, icone: Users, formato: numero },
    { chave: "recorrencia", titulo: "Clientes recorrentes", descricao: "No histórico disponível", ajuda: `Proporção dos compradores identificados no período com pelo menos duas compras válidas no histórico disponível até a data final. Compras posteriores não contam. O histórico anterior à primeira data disponível pode estar incompleto. Tempo médio de recompra baseado em ${numero(dados.recompra.intervalos)} intervalos de ${numero(dados.recompra.clientes)} clientes recorrentes.`, icone: RefreshCw, formato: percentual },
    { chave: "frete", titulo: "Frete", descricao: "Não representa custo logístico", ajuda: "Frete cobrado dos clientes, separado de custo de entrega e subsídio. Valores negativos e ajustes comerciais são preservados. Aumento do frete não representa melhoria automática.", icone: Truck, formato: moeda },
  ];
  function abrirFiltros() { definirRascunho(filtros); definirPainel("filtros"); }
  function abrirPedidos() { definirPainel("pedidos"); if (filtrosRef.current.pagina !== 1) void aplicar({ pagina: 1 }, true); }
  function alterarAba(aba: AbaBi) { void aplicar({ aba, somenteSemRecompra: aba === "clientes" && filtrosRef.current.somenteSemRecompra }); }
  function selecionarColuna(item: SerieBi) { definirPainel("pedidos"); void aplicar({ de: item.de, ate: item.ate }); }
  const ativos = (["canal", "categoria", "produto", "cliente", "regiao", "modalidade"] as const).filter(k => filtros[k]);
  const maximaRegiao = Math.max(...dados.regioes.map(r => r.pedidos), 1);
  const temBase = c.primeiraData !== null;
  const faixaCepInvalida = Boolean(rascunho.cepDe && rascunho.cepDe.length !== 8 || rascunho.cepAte && rascunho.cepAte.length !== 8 || rascunho.cepDe && rascunho.cepAte && rascunho.cepDe > rascunho.cepAte);
  return <div className={s.pagina} aria-busy={carregando} data-testid="bi-vendas">
    <header className={s.cabecalho}>
      <div className="min-w-0"><h1 className="text-display">Dashboard</h1><p className={s.subtitulo}>Visão completa das suas vendas, clientes e entregas em um só lugar.</p></div>
      <div className={s.cabecalhoAcoes}>
        <p className={s.atualizacao}>Última atualização: {dados.atualizadoEm ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium", timeStyle: "short" }).format(new Date(dados.atualizadoEm)) : "Não informada"}</p>
        <GrupoAcoes nome="Ações do Dashboard" className="min-w-0 flex-wrap">
          <Button formato="campo" variant="ghost" size="sm" onClick={() => definirPainel("cobertura")}><CircleHelp aria-hidden="true" />Ver cobertura</Button>
          {dados.permissoes.pedidos && <Button formato="campo" variant="outline" onClick={abrirPedidos}><FileText aria-hidden="true" />Ver pedidos</Button>}
          {dados.permissoes.exportar && <Button formato="campo" role="link" nativeButton={false} render={<a href={`/api/vendas/bi/exportar?${parametrosBi(filtros)}`} />} disabled={carregando}><Download aria-hidden="true" />Exportar</Button>}
        </GrupoAcoes>
      </div>
    </header>
    <Tabs value={filtros.aba} onValueChange={v => alterarAba(v as AbaBi)} className={s.abas}><TabsList variant="line" aria-label="Análises de vendas">{ABAS.map(([id, nome]) => { const restrita = id === "clientes" && !dados.permissoes.contatos || id === "rentabilidade" && !dados.permissoes.custos; return <TabsTrigger key={id} value={id} disabled={restrita} title={restrita ? `Requer permissão para ${id === "clientes" ? "dados de clientes" : "custos"}` : undefined}>{nome}</TabsTrigger>; })}</TabsList></Tabs>
    <div className={s.periodoLinha}>
      <FiltroPeriodo de={filtros.de} ate={filtros.ate} aoAlterar={periodo => void aplicar(periodo)}
        acoes={<div className={s.filtroComparacao}><Seletor className="h-9!" nome="Comparação" valor={filtros.comparacao} alterar={comparacao => void aplicar({ comparacao: comparacao as FiltrosBi["comparacao"] })} opcoes={[{ id: "nenhuma", nome: "Sem comparação" }, { id: "anterior", nome: "Período anterior equivalente" }, { id: "ano-anterior", nome: "Mesmo período do ano anterior" }]} /></div>} />
    </div>
    <div className={s.filtros} aria-label="Filtros globais">
      <Seletor nome="Canal" valor={filtros.canal} alterar={canal => void aplicar({ canal })} opcoes={dados.opcoes.canais} todos="Todos" />
      <Seletor nome="Categoria" valor={filtros.categoria} alterar={categoria => void aplicar({ categoria })} opcoes={dados.opcoes.categorias} todos="Todas" />
      <Button formato="campo" variant="outline" onClick={abrirFiltros}><Filter aria-hidden="true" />Mais filtros</Button>
    </div>
    {(ativos.length > 0 || filtros.origem !== "todas" || filtros.somenteConfirmados || filtros.somenteSemRecompra || filtros.tipoCliente !== "todos" || filtros.cepDe || filtros.cepAte) && <div className={s.ativos}><span>Filtros ativos:</span>{(filtros.cepDe || filtros.cepAte) && <Badge variant="muted">CEP: {filtros.cepDe || "Início"} — {filtros.cepAte || "Fim"}</Badge>}{filtros.tipoCliente !== "todos" && <Badge variant="muted">Tipo: {filtros.tipoCliente === "PF" ? "Pessoa física" : "Pessoa jurídica"}</Badge>}{ativos.map(k => <Badge variant="muted" key={k}>{({ canal: "Canal", categoria: "Categoria", produto: "Produto", cliente: "Cliente", regiao: "Região", modalidade: "Modalidade" })[k]}: {(dados.opcoes[({ canal: "canais", categoria: "categorias", produto: "produtos", cliente: "clientes", regiao: "regioes", modalidade: "modalidades" } as const)[k]].find(o => o.id === filtros[k])?.nome) ?? filtros[k]}</Badge>)}{filtros.origem !== "todas" && <Badge variant="muted">Origem: {filtros.origem === "historico" ? "Histórico" : "Nativo"}</Badge>}{filtros.somenteConfirmados && <Badge variant="muted">Destinos confirmados</Badge>}{filtros.somenteSemRecompra && <Badge variant="muted">Sem recompra há {filtros.diasSemRecompra} dias</Badge>}<Button formato="campo" variant="link" size="sm" onClick={() => void aplicar({ canal: "", categoria: "", produto: "", cliente: "", regiao: "", modalidade: "", origem: "todas", somenteConfirmados: false, somenteSemRecompra: false, tipoCliente: "todos", cepDe: "", cepAte: "" })}>Limpar filtros</Button></div>}
    {erro && <div className={s.aviso} role="alert"><p>{erro}</p><Button formato="campo" size="sm" variant="outline" onClick={() => void aplicar(ultimaTentativa.current, true)}>Tentar novamente</Button></div>}
    {filtros.baseData === "entrega" && <p className={s.aviso} role="status">Data de entrega: {numero(c.pedidosSemData)} registros ficaram sem data e não entram na seleção. A data do pedido não substitui a data de entrega.</p>}
    {!temBase && <p className={s.aviso} role="status">Ainda não há vendas disponíveis nesta fonte. Os indicadores exibem apenas resultados conhecidos. Consulte a cobertura.</p>}
    {filtros.aba === "geral" ? <>
      <section className={s.indicadores} aria-label="Indicadores de vendas">{indicadores.map(({ chave, titulo, descricao, ajuda, icone: Icon, formato }) => { const variacao = dados.variacoes[chave]; return <Tooltip key={chave}><TooltipTrigger render={<Card size="sm" className={`${s.indicador} ${chave === "vendas" ? s.faturamento : ""}`} tabIndex={0} aria-label={`${titulo}. ${formato(dados.indicadores[chave])}. ${descricao}`} />}><div className={s.indicadorTopo}><span className={s.icone}><Icon aria-hidden="true" className="size-5" /></span><h2 className={s.indicadorTitulo}>{titulo}</h2></div>{carregando ? <div className={s.esqueleto} aria-label="Atualizando indicador" /> : <p className={s.indicadorValor} data-longo={formato(dados.indicadores[chave]).length > 13}>{formato(dados.indicadores[chave])}</p>}{filtros.comparacao !== "nenhuma" && <p className={s.variacao}>{variacao.estado === "comparavel" && variacao.valor !== null ? <><span className={`inline-flex items-center gap-1 font-semibold ${(chave === "frete" || chave === "descontos") ? "text-muted-foreground" : variacao.valor >= 0 ? "text-success" : "text-destructive"}`}>{variacao.valor >= 0 ? <ArrowUp aria-hidden="true" className="size-3" /> : <ArrowDown aria-hidden="true" className="size-3" />}{variacao.valor > 0 ? "+" : ""}{numero(variacao.valor)} {variacao.unidade}</span><span>vs. período comparado</span></> : "Sem base comparável"}</p>}<p className={s.indicadorDescricao}>{descricao}</p>{chave === "recorrencia" && <p className={s.recompra}>Tempo médio de recompra: {carregando ? "Atualizando…" : dados.recompra.mediaDias === null ? "Não apurado" : `${numero(dados.recompra.mediaDias)} dias`}</p>}</TooltipTrigger><TooltipContent>{ajuda}</TooltipContent></Tooltip>; })}</section>
      <div className={s.principal}><Bloco titulo="Evolução das vendas" descricao={filtros.metrica === "vendas" ? "Produtos e frete cobrado no período." : "Pedidos no período."} acoes={<div className={s.controlesGrafico}><Seletor compacto nome="Agrupamento" valor={filtros.agrupamento} alterar={agrupamento => void aplicar({ agrupamento: agrupamento as FiltrosBi["agrupamento"] })} opcoes={[{ id: "dia", nome: "Diário" }, { id: "semana", nome: "Semanal" }, { id: "mes", nome: "Mensal" }]} /><Alternador nome="Métrica da evolução" valor={filtros.metrica} opcoes={[["vendas", "Faturamento"], ["pedidos", "Pedidos"]]} alterar={metrica => void aplicar({ metrica })} /><ValoresGrafico serie={dados.serie} selecionar={selecionarColuna} /></div>}><GraficoVendas serie={dados.serie} metrica={filtros.metrica} comparar={filtros.comparacao !== "nenhuma"} selecionar={selecionarColuna} /></Bloco>
      <Bloco titulo="Pessoa física e jurídica" descricao="Participação dos pedidos e do faturamento por tipo de comprador." acoes={dados.permissoes.contatos && <Alternador nome="Métrica por tipo de pessoa" valor={metricaClientes} opcoes={[["pedidos", "Pedidos"], ["faturamento", "Faturamento"]]} alterar={definirMetricaClientes} />}><GraficoClientes distribuicao={dados.distribuicaoClientes} metrica={metricaClientes} /></Bloco></div>
      <div className={s.inferior}><Bloco titulo="Entregas por região" descricao="Distribuição disponível dos destinos de entrega." acoes={<Seletor compacto nome="Agrupar entregas por" valor={filtros.agrupamentoRegiao} opcoes={[{ id: "bairro", nome: "Bairro" }, { id: "cep", nome: "Faixa de CEP" }]} alterar={agrupamentoRegiao => void aplicar({ agrupamentoRegiao: agrupamentoRegiao as FiltrosBi["agrupamentoRegiao"], regiao: "" })} />}><MapaCalorEntregas key={parametrosBi(filtros)} parametros={parametrosBi(filtros)} chave={chaveMapa} /><div className={s.regioes}>{dados.regioes.slice(0, 4).map(r => <div className={s.regiao} key={r.nome}><span>{r.nome}</span><strong>{numero(r.pedidos)}</strong><div className={s.barraTrilho}><div className={s.barra} style={{ width: `${r.pedidos / maximaRegiao * 100}%` }} /></div></div>)}{!dados.regioes.length && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin aria-hidden="true" className="size-5 shrink-0" />Nenhuma região de entrega informada nesta seleção.</div>}<p className={s.legendaRegioes}>Distribuição regional · {numero(c.localizadas)}/{numero(c.entregas)} com região informada. Retiradas excluídas.</p></div><label className={s.confirmados}><Checkbox checked={filtros.somenteConfirmados} onCheckedChange={somenteConfirmados => void aplicar({ somenteConfirmados: Boolean(somenteConfirmados) })} />Exibir apenas destinos confirmados</label></Bloco>
      <Bloco titulo="Produtos que mais vendem" descricao={filtros.ranking === "receita" ? "Receita dos produtos no período · sem frete." : "Quantidade vendida por unidade comercial."} acoes={<Alternador nome="Métrica do ranking" valor={filtros.ranking} opcoes={[["receita", "Receita"], ["quantidade", "Quantidade"]]} alterar={ranking => void aplicar({ ranking })} />}><div className={s.ranking}>{dados.ranking.slice(0, 5).map((p, i) => { const valor = filtros.ranking === "receita" ? p.receita : p.quantidade; const max = Math.max(...dados.ranking.slice(0,5).map(r => (filtros.ranking === "receita" ? r.receita : r.quantidade) ?? 0), 1); return <div className={s.rankingLinha} key={`${p.id}:${p.unidade}`}><span className={s.posicao}>{i + 1}</span><div className={s.rankingNome}><Button formato="campo" size="xs" variant="link" title={p.nome} onClick={() => void aplicar({ aba: "produtos", produto: p.id })}><span>{p.nome}</span></Button></div><div className={s.barraTrilho} aria-hidden="true"><div className={s.barra} style={{ width: `${Math.max(0, (valor ?? 0) / max * 100)}%` }} /></div><span className={s.rankingValor}>{filtros.ranking === "receita" ? compacto(p.receita, true) : `${numero(p.quantidade)} ${p.unidade}`}</span></div>; })}{!dados.ranking.length && <div className={s.vazio}>Nenhum produto vendido na seleção.</div>}</div><div className={s.linkRodape}><Button formato="campo" variant="link" size="sm" onClick={() => alterarAba("produtos")}>Ver ranking completo<ArrowRight aria-hidden="true" /></Button></div></Bloco>
      <Bloco titulo="Clientes que mais compram" descricao="Faturamento dos principais compradores no período.">
        {!dados.permissoes.contatos ? <div className={s.vazio}><Users aria-hidden="true" />Consulta restrita à permissão de clientes.</div> : <>
          <Table aria-label="Clientes que mais compram" className={s.resumoClientes}><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Faturamento</TableHead></TableRow></TableHeader><TableBody>{dados.rankingClientes.slice(0, 5).map(cliente => <TableRow key={cliente.id}>
            <TableCell className="min-w-0"><div className={s.rankingNome}><Button formato="campo" variant="link" size="xs" title={cliente.nome} onClick={() => void aplicar({ aba: "clientes", cliente: cliente.id, somenteSemRecompra: false })}><span>{cliente.nome}</span></Button></div></TableCell>
            <TableCell><Badge variant="secondary" title={cliente.tipo === "PF" ? "Pessoa física" : cliente.tipo === "PJ" ? "Pessoa jurídica" : "Tipo não informado"}>{cliente.tipo ?? "—"}</Badge></TableCell>
            <TableCell className="text-right tabular-nums whitespace-nowrap">{moeda(cliente.valor)}</TableCell>
          </TableRow>)}</TableBody></Table>{!dados.rankingClientes.length && <div className={s.vazio}>Nenhum cliente identificável nesta seleção.</div>}
          <div className={s.linkRodape}><Button formato="campo" variant="link" size="sm" onClick={() => alterarAba("clientes")}>Ver ranking de clientes<ArrowRight aria-hidden="true" /></Button></div>
        </>}
      </Bloco>
      <Bloco titulo="Categorias mais vendidas" descricao="Ranking por receita dos produtos na seleção."><RankingCategorias categorias={dados.rankingCategorias} selecionar={categoria => void aplicar({ categoria, produto: "", aba: "produtos" })} /></Bloco></div>
      <p className={s.rodape}>{temBase ? `Histórico disponível: ${data(c.primeiraData)} a ${data(c.ultimaData)}.` : "Histórico ainda indisponível."} {c.parcial ? "Cobertura parcial. " : ""}Importação completa não comprovada. Custos e endereços dependem de fontes verificáveis.</p>
    </> : <Detalhamento dados={dados} filtros={filtros} alterar={aplicar} />}
    <Dialog open={painel !== null} onOpenChange={v => { if (!v) definirPainel(null); }} protegerAlteracoes={false}><DialogContent variant="painel-direito"><DialogHeader className={s.painelCabecalho}><DialogTitle>{painel === "filtros" ? "Mais filtros" : painel === "cobertura" ? "Cobertura e definições" : "Pedidos da seleção"}</DialogTitle><DialogDescription>{painel === "filtros" ? "Refine a análise sem alterar dados operacionais." : painel === "cobertura" ? "Fontes disponíveis e limites dos indicadores." : `${periodo} · Mesmas regras dos indicadores.`}</DialogDescription></DialogHeader><div className={s.painelConteudo}>
      {painel === "filtros" && <>{([ ["produto", "Produto", "produtos"], ["cliente", "Cliente comprador", "clientes"], ["regiao", "Região", "regioes"], ["modalidade", "Modalidade de entrega", "modalidades"] ] as const).filter(([k]) => k !== "cliente" || dados.permissoes.contatos).map(([k, rotulo, opcoes]) => <label className={s.campo} key={k}>{rotulo}{k === "cliente" ? <SeletorCliente valor={rascunho.cliente} opcoes={dados.opcoes.clientes} alterar={cliente => definirRascunho(v => ({ ...v, cliente }))} /> : <Seletor nome={rotulo} valor={rascunho[k]} opcoes={dados.opcoes[opcoes]} todos="Todos" alterar={valor => definirRascunho(v => ({ ...v, [k]: valor }))} />}</label>)}<label className={s.campo}>Origem do registro<Seletor nome="Origem do registro" valor={rascunho.origem} opcoes={[{ id: "todas", nome: "Todas as origens" }, { id: "historico", nome: "Histórico importado" }, { id: "nativo", nome: "Nativo do HUB" }]} alterar={origem => definirRascunho(v => ({ ...v, origem: origem as FiltrosBi["origem"] }))} /></label><div className="grid grid-cols-2 gap-3"><label className={s.campo}>CEP inicial<Input inputMode="numeric" restricao="digitos" maxLength={8} placeholder="00000000" value={rascunho.cepDe} onChange={e => definirRascunho(v => ({ ...v, cepDe: e.target.value }))} /></label><label className={s.campo}>CEP final<Input inputMode="numeric" restricao="digitos" maxLength={8} placeholder="99999999" value={rascunho.cepAte} onChange={e => definirRascunho(v => ({ ...v, cepAte: e.target.value }))} /></label></div><p className="text-xs text-muted-foreground">Faixa inclusiva. Informe oito dígitos por CEP ou deixe o limite vazio.</p>{faixaCepInvalida && <p role="alert" className="text-xs text-destructive">Complete os CEPs com oito dígitos. O CEP inicial deve ser menor ou igual ao final.</p>}<label className={s.campo}>Intervalo sem recompra (dias)<Input type="text" inputMode="numeric" restricao="digitos" min={1} maxLength={4} value={rascunho.diasSemRecompra} onChange={e => definirRascunho(v => ({ ...v, diasSemRecompra: Math.min(3650, Math.max(1, Number(e.target.value) || 1)) }))} /></label><p className="text-xs text-muted-foreground">O intervalo considera a data final da análise. Não envia mensagens ou campanhas.</p></>}
      {painel === "cobertura" && <><dl className="grid grid-cols-2 gap-3 text-xs">{[["Primeira data disponível", data(c.primeiraData)], ["Última data disponível", data(c.ultimaData)], ["Pedidos históricos", numero(c.pedidosHistoricos)], ["Pedidos nativos", numero(c.pedidosNativos)], ["Sem comprador identificável", numero(c.pedidosSemCliente)], ["Sem data selecionada", numero(c.pedidosSemData)], ["Sem detalhamento", `${numero(c.pedidosSemDetalhamento)} · ${moeda(c.valorSemDetalhamento)}`], ["Duplicidades excluídas", numero(c.duplicidadesExcluidas)], ["Destinos confirmados", numero(c.confirmadas)], ["Localização aproximada", numero(c.aproximadas)], ["Sem região informada", numero(c.semEndereco)], ["Destinos não validados", numero(Math.max(0, c.entregas - c.confirmadas - c.aproximadas))], ["Modalidade não informada", numero(c.modalidadeNaoInformada)], ["Fretes negativos", numero(c.fretesNegativos)], ["Ajustes de frete", moeda(c.ajustesFrete)], ["Ajustes comerciais não classificados", moeda(c.ajustesComerciaisNaoClassificados)], ["Pedidos com ajustes comerciais", numero(c.pedidosComAjusteComercial)], ["Reduções sem componente confirmado", `${numero(c.pedidosComReducaoSemComponente)} · ${moeda(c.reducaoComercialSemComponente)}`], ["Receita de produtos conhecida", `${moeda(c.vendasProdutosConhecidas)} · ${numero(c.pedidosComReceitaApurada)} pedidos`], ["Frete cobrado conhecido", `${moeda(c.freteCobradoConhecido)} · ${numero(c.pedidosComFreteApurado)} pedidos`], ["Entregas com frete e custo conhecidos", numero(c.entregasComFreteECusto)], ["Custos de produtos", c.custosProdutos === null ? "Não apurados" : numero(c.custosProdutos)], ["Custos de entrega", c.custosEntrega === null ? "Não apurados" : numero(c.custosEntrega)]].map(([rotulo, valor]) => <div key={rotulo}><dt className="text-muted-foreground">{rotulo}</dt><dd className="mt-1 font-medium">{valor}</dd></div>)}</dl><h3 className="font-semibold">Importação histórica</h3><p className="text-xs">{c.importacao === "sem-registros" ? "Nenhum registro de importação encontrado." : "Registros históricos disponíveis."} A conclusão integral da importação não está comprovada.</p><h3 className="font-semibold">Marco financeiro · 01/09/2026</h3><p className="text-xs">Referência de implantação. Não comprova conciliação nem validação financeira. Vendas comerciais anteriores permanecem disponíveis.</p>{c.avisos.map(aviso => <p className="text-xs text-muted-foreground" key={aviso}>{aviso}</p>)}<h3 className="font-semibold">Definições dos indicadores</h3>{dados.definicoes.map(def => <p className="text-xs" key={def}>{def}</p>)}<p className="text-xs text-muted-foreground">Consulta executada em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(new Date(dados.consultadoEm))}. Tempo: {numero(dados.duracaoMs)} ms.</p></>}
      {painel === "pedidos" && (carregando ? <p role="status" className="text-sm text-muted-foreground">Consultando pedidos da seleção...</p> : erro ? <div role="alert"><p>{erro}</p><Button formato="campo" variant="outline" size="sm" onClick={() => void aplicar({ pagina: 1 }, true)}>Tentar novamente</Button></div> : <><Table><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Frete</TableHead></TableRow></TableHeader><TableBody>{dados.pedidos.linhas.map(p => <TableRow key={`${p.origem}-${p.id}`}><TableCell><span className="block font-medium">{p.numero}</span><span className="text-xs text-muted-foreground">{p.origem === "historico" ? "Histórico" : "HUB"}</span>{dados.permissoes.pedidos && <Button formato="campo" variant="link" size="sm" nativeButton={false} render={<Link href={`https://${HOST_PEDIDOS}/vendas/pedidos/${encodeURIComponent(p.id)}`} />}>Abrir</Button>}</TableCell><TableCell>{data(p.data)}</TableCell><TableCell className="text-right tabular-nums">{moeda(p.receita)}</TableCell><TableCell className="text-right tabular-nums">{moeda(p.frete)}</TableCell></TableRow>)}</TableBody></Table>{!dados.pedidos.total && <p className={s.vazio}>Nenhum pedido válido nesta seleção.</p>}<Paginacao {...dados.pedidos} alterar={pagina => void aplicar({ pagina }, true)} /><p className="text-xs text-muted-foreground">Os números originais dos pedidos históricos são preservados. Totais consultados: {numero(dados.pedidos.total)} pedidos · {moeda(dados.indicadores.vendas)} de faturamento (inclui frete).</p></>)}
    </div>{painel === "filtros" && <div className={s.painelRodape}><GrupoAcoes nome="Aplicação de filtros"><Button formato="campo" variant="outline" onClick={() => definirPainel(null)}>Voltar</Button><Button formato="campo" disabled={faixaCepInvalida} onClick={() => { definirPainel(null); void aplicar(rascunho); }}>Aplicar filtros</Button></GrupoAcoes></div>}</DialogContent></Dialog>
    {carregando && <p role="status" className="sr-only">Atualizando indicadores da seleção.</p>}
  </div>;
}

function Detalhamento({ dados, filtros, alterar }: { dados: ResultadoBi; filtros: FiltrosBi; alterar: (alteracao: Partial<FiltrosBi>, preservarPagina?: boolean) => Promise<void> }) {
  const ordenarProdutos = (ordemProdutos: FiltrosBi["ordemProdutos"]) => void alterar({ ordemProdutos, direcaoProdutos: filtros.ordemProdutos === ordemProdutos && filtros.direcaoProdutos === "asc" ? "desc" : "asc" });
  const ordenarClientes = (ordemClientes: FiltrosBi["ordemClientes"]) => void alterar({ ordemClientes, direcaoClientes: filtros.ordemClientes === ordemClientes && filtros.direcaoClientes === "asc" ? "desc" : "asc" });
  const ordenarEntregas = (ordemEntregas: FiltrosBi["ordemEntregas"]) => void alterar({ ordemEntregas, direcaoEntregas: filtros.ordemEntregas === ordemEntregas && filtros.direcaoEntregas === "asc" ? "desc" : "asc" });
  if (filtros.aba === "rentabilidade") return <Bloco titulo="Rentabilidade" descricao="Somente custos sustentados por fontes confiáveis.">
    {!dados.permissoes.custos ? <div className={s.vazio}><CircleHelp aria-hidden="true" />Você não tem permissão para consultar custos.</div> : <>
      <div className={s.custos}>{[["Receita com custo conhecido", moeda(dados.rentabilidade.receitaCoberta)], ["Custo dos produtos", moeda(dados.rentabilidade.custoProdutos)], ["Margem na receita coberta", percentual(dados.rentabilidade.margem)]].map(([nome, valor]) => <div key={nome}><p className="text-xs text-muted-foreground">{nome}</p><p className="mt-2 text-title tabular-nums">{valor}</p></div>)}</div>
      <p className="text-sm">Cobertura dos custos: {percentual(dados.rentabilidade.cobertura)}.</p><p className="text-xs text-muted-foreground">{dados.rentabilidade.baseCustos}</p><p className="text-xs text-muted-foreground">Receita e custos parciais não representam lucro líquido. O custo atual não recalcula a margem histórica.</p>
    </>}
  </Bloco>;
  if (filtros.aba === "produtos") return <Bloco titulo="Ranking completo de produtos" descricao="Receita líquida, quantidade e participação na seleção. Unidades comerciais são preservadas.">
    <Table><TableHeader><TableRow>{([
      ["nome", "Produto"], ["receita", "Receita líquida"], ["quantidade", "Quantidade"], ["participacao", "Participação"], ["pedidos", "Pedidos"], ["ticket", "Ticket dos pedidos"],
    ] as const).map(([coluna, rotulo]) => <ColunaOrdenavel key={coluna} coluna={coluna} ordem={filtros.ordemProdutos} direcao={filtros.direcaoProdutos} alterar={ordenarProdutos}>{rotulo}</ColunaOrdenavel>)}</TableRow></TableHeader>
      <TableBody>{dados.produtos.linhas.map(p => <TableRow key={`${p.id}:${p.unidade}`}>
        <TableCell><Button formato="campo" variant="link" size="sm" onClick={() => void alterar({ produto: p.id })}>{p.nome}</Button></TableCell>
        <TableCell className="text-right">{moeda(p.receita)}</TableCell><TableCell className="text-right">{p.quantidade === null ? "Não informada" : `${numero(p.quantidade)} ${p.unidade}`}</TableCell>
        <TableCell className="text-right">{percentual(p.participacao)}</TableCell><TableCell className="text-right">{numero(p.pedidos)}</TableCell><TableCell className="text-right">{moeda(p.ticket)}</TableCell>
      </TableRow>)}</TableBody>
    </Table>{!dados.produtos.total && <div className={s.vazio}>Nenhum produto nesta seleção.</div>}<Paginacao {...dados.produtos} alterar={pagina => void alterar({ pagina }, true)} />
  </Bloco>;
  if (filtros.aba === "clientes") return <Bloco titulo={filtros.somenteSemRecompra ? `Clientes sem recomprar há ${filtros.diasSemRecompra} dias` : "Clientes compradores"} descricao={filtros.somenteSemRecompra ? `Pedidos e valores no histórico disponível até ${filtros.ate ? data(filtros.ate) : "a última data disponível"}. O intervalo sem recompra considera essa data final.` : "Compradores identificados na seleção. Tipo conforme o cadastro comercial."}>
    {!dados.permissoes.contatos ? <div className={s.vazio}><Users aria-hidden="true" />Você não tem permissão para consultar os dados dos clientes.</div> : <>
      <div className="w-full min-w-0 sm:max-w-md"><SeletorCliente valor={filtros.cliente} opcoes={dados.opcoes.clientes} alterar={cliente => void alterar({ cliente })} /></div>
      <FiltroOpcoesContadas nome="Filtrar clientes por tipo" valor={filtros.tipoCliente} onValueChange={tipoCliente => void alterar({ tipoCliente })} opcoes={[
        { valor: "todos", nome: "Todos", quantidade: dados.tiposClientes.todos },
        { valor: "PF", nome: "Pessoa física", quantidade: dados.tiposClientes.PF },
        { valor: "PJ", nome: "Pessoa jurídica", quantidade: dados.tiposClientes.PJ },
      ]} />
      {dados.tiposClientes.naoInformado > 0 && <p className="text-xs text-muted-foreground">{numero(dados.tiposClientes.naoInformado)} clientes sem tipo informado; incluídos em Todos.</p>}
      {filtros.cliente && !filtros.categoria && !filtros.produto && <p className="text-xs text-muted-foreground">{numero(dados.cobertura.pedidosTotalOriginalHistorico)} pedidos históricos · Total original na fonte: {moeda(dados.cobertura.totalOriginalHistorico)} · Ajustes históricos de frete: {moeda(dados.cobertura.ajustesFrete)} (separados das vendas)</p>}
      <Table><TableHeader><TableRow>{([
        ["nome", "Cliente"], ["tipo", "Tipo"], ["compras", "Pedidos"], ["valor", "Valor gasto"], ["ticket", "Ticket"], ["primeira", "Primeiro pedido"], ["ultima", "Último pedido"],
      ] as const).map(([coluna, rotulo]) => <ColunaOrdenavel key={coluna} coluna={coluna} ordem={filtros.ordemClientes} direcao={filtros.direcaoClientes} alterar={ordenarClientes}>{rotulo}</ColunaOrdenavel>)}</TableRow></TableHeader>
        <TableBody>{dados.clientes.linhas.map(c => <TableRow key={c.id}>
          <TableCell>{c.nome}</TableCell><TableCell>{c.tipo === "PF" ? "Pessoa física" : c.tipo === "PJ" ? "Pessoa jurídica" : "Não informado"}</TableCell>
          <TableCell className="text-right">{numero(c.compras)}</TableCell><TableCell className="text-right">{moeda(c.valor)}</TableCell><TableCell className="text-right">{moeda(c.ticket)}</TableCell>
          <TableCell>{data(c.primeira)}</TableCell><TableCell>{data(c.ultima)}</TableCell>
        </TableRow>)}</TableBody>
      </Table>{!dados.clientes.total && <div className={s.vazio}>Nenhum cliente identificável nesta seleção.</div>}<Paginacao {...dados.clientes} alterar={pagina => void alterar({ pagina }, true)} />
      {filtros.somenteSemRecompra && <Button formato="campo" variant="link" size="sm" onClick={() => void alterar({ somenteSemRecompra: false })}>Exibir todos os compradores</Button>}
    </>}<p className="text-xs text-muted-foreground">{numero(dados.cobertura.pedidosSemCliente)} pedidos sem comprador identificável.</p>
  </Bloco>;
  return <Bloco titulo="Entregas" descricao="Retiradas não entram na distribuição regional. Endereços de cobrança não substituem destinos." acoes={<Seletor compacto nome="Agrupar entregas por" valor={filtros.agrupamentoRegiao} opcoes={[{ id: "bairro", nome: "Bairro" }, { id: "cep", nome: "Faixa de CEP" }]} alterar={agrupamentoRegiao => void alterar({ agrupamentoRegiao: agrupamentoRegiao as FiltrosBi["agrupamentoRegiao"], regiao: "" })} />}>
    <Table><TableHeader><TableRow>
      <ColunaOrdenavel coluna="nome" ordem={filtros.ordemEntregas} direcao={filtros.direcaoEntregas} alterar={ordenarEntregas}>{filtros.agrupamentoRegiao === "cep" ? "Faixa de CEP" : "Bairro"}</ColunaOrdenavel>
      <ColunaOrdenavel coluna="pedidos" ordem={filtros.ordemEntregas} direcao={filtros.direcaoEntregas} alterar={ordenarEntregas}>Entregas</ColunaOrdenavel>
      <ColunaOrdenavel coluna="frete" ordem={filtros.ordemEntregas} direcao={filtros.direcaoEntregas} alterar={ordenarEntregas}>Frete</ColunaOrdenavel>
      {dados.permissoes.custos && <ColunaOrdenavel coluna="custo" ordem={filtros.ordemEntregas} direcao={filtros.direcaoEntregas} alterar={ordenarEntregas}>Custo conhecido</ColunaOrdenavel>}
      <ColunaOrdenavel coluna="confirmados" ordem={filtros.ordemEntregas} direcao={filtros.direcaoEntregas} alterar={ordenarEntregas}>Confirmados</ColunaOrdenavel>
      <ColunaOrdenavel coluna="aproximados" ordem={filtros.ordemEntregas} direcao={filtros.direcaoEntregas} alterar={ordenarEntregas}>Aproximados</ColunaOrdenavel><ColunaOrdenavel coluna="naoValidados" ordem={filtros.ordemEntregas} direcao={filtros.direcaoEntregas} alterar={ordenarEntregas}>Não validados</ColunaOrdenavel>
    </TableRow></TableHeader><TableBody>{dados.entregas.linhas.map(r => <TableRow key={r.nome}>
      <TableCell>{r.nome}</TableCell><TableCell className="text-right">{numero(r.pedidos)}</TableCell><TableCell className="text-right">{moeda(r.frete)}</TableCell>
      {dados.permissoes.custos && <TableCell className="text-right">{moeda(r.custo)}<span className="block text-xs text-muted-foreground">{numero(r.custosConhecidos)}/{numero(r.pedidos)} entregas</span></TableCell>}
      <TableCell className="text-right">{numero(r.confirmados)}</TableCell><TableCell className="text-right">{numero(r.aproximados)}</TableCell><TableCell className="text-right">{numero(r.naoValidados)}</TableCell>
    </TableRow>)}</TableBody></Table>
    {!dados.entregas.total && <div className={s.vazio}>Nenhuma entrega com destino disponível nesta seleção.</div>}<Paginacao {...dados.entregas} alterar={pagina => void alterar({ pagina }, true)} />
    <p className="text-xs text-muted-foreground">Cobertura regional: {numero(dados.cobertura.localizadas)}/{numero(dados.cobertura.entregas)} entregas com região informada. {dados.permissoes.custos ? `Grupo com frete e custo conhecidos: ${numero(dados.cobertura.entregasComFreteECusto)}/${numero(dados.cobertura.entregas)} entregas. Frete cobrado nesse grupo: ${moeda(dados.rentabilidade.freteCoberto)}. Custo nesse grupo: ${moeda(dados.rentabilidade.custoEntrega)}. Subsídio: ${moeda(dados.rentabilidade.subsidio)}.` : "Custos restritos à permissão específica."}</p>
  </Bloco>;
}
