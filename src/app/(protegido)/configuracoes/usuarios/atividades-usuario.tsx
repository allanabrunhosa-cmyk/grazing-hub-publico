"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ExternalLink, History, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { MODULOS, ORIGENS, RESULTADOS, type DetalheAtividade, type FiltrosAtividades, type PaginaAtividades } from "@/lib/atividades/types";

const nomes: Record<string, string> = {
  autenticacao: "Autenticação", acessos: "Usuários e permissões", cadastros: "Cadastros", insumos: "Insumos",
  pedidos: "Pedidos", compras: "Compras", financeiro: "Financeiro", estoque: "Estoque", etiquetas: "Etiquetas",
  design: "Central de Design", integracoes: "Integrações", INTERFACE: "Interface", API: "API", MCP: "MCP",
  AUTOMACAO: "Automação", NAO_IDENTIFICADA: "Origem não identificada", SUCESSO: "Sucesso", FALHA: "Falha",
  NEGADO: "Acesso negado", SOLICITADO: "Solicitado", CONFIRMADO: "Confirmado", USUARIO: "Usuário",
  SISTEMA: "Sistema", INTEGRACAO: "Integração",
  Usuario: "Usuário", PerfilAcesso: "Perfil de acesso", Sessao: "Sessão", PedidoVenda: "Pedido de venda",
  PedidoCompra: "Pedido de compra", ProdutoVenda: "Produto", ClienteVenda: "Cliente", Fornecedor: "Fornecedor",
  Insumo: "Insumo", InventarioContagem: "Contagem de estoque", MovimentacaoEstoque: "Movimentação de estoque",
  LancamentoFinanceiro: "Lançamento financeiro", TrabalhoEtiqueta: "Trabalho de impressão de etiquetas",
};
const nome = (valor: string) => nomes[valor] ?? valor;
const dataHora = (valor: string) => new Date(valor).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
type Filtros = Omit<FiltrosAtividades, "usuarioId" | "cursor">;
type Estado = "carregando" | "pronto" | "erro" | "negado";

function periodoInicial(): Filtros {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const obter = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  const ate = `${obter("year")}-${obter("month")}-${obter("day")}`;
  const inicio = new Date(`${ate}T12:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - 29);
  return { de: inicio.toISOString().slice(0, 10), ate, perspectiva: "autor" };
}

function parametros(filtros: Filtros, cursor?: string) {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries({ ...filtros, cursor })) if (valor) parametros.set(chave, valor);
  return parametros.toString();
}

/** A autorização efetiva e a seleção dos campos permitidos continuam no servidor. */
export function AtividadesUsuario({ usuarioId, nomeUsuario, podeVer }: { usuarioId: string; nomeUsuario: string; podeVer: boolean }) {
  if (!podeVer) return <Card size="sm"><CardContent className="flex items-start gap-3"><ShieldCheck className="size-5 shrink-0 text-muted-foreground" /><p role="status">Seu perfil não permite consultar atividades de usuários.</p></CardContent></Card>;
  return <ConsultaAtividades key={usuarioId} usuarioId={usuarioId} nomeUsuario={nomeUsuario} />;
}

function ConsultaAtividades({ usuarioId, nomeUsuario }: { usuarioId: string; nomeUsuario: string }) {
  const [rascunho, setRascunho] = useState<Filtros>(periodoInicial);
  const [consulta, setConsulta] = useState(() => ({ filtros: rascunho, revisao: 0, cursor: undefined as string | undefined }));
  const [pagina, setPagina] = useState<PaginaAtividades | null>(null);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheAtividade | null>(null);
  const [estadoDetalhe, setEstadoDetalhe] = useState<Estado>("pronto");
  const [erroDetalhe, setErroDetalhe] = useState("");
  const cancelamentoDetalhe = useRef<AbortController | null>(null);
  const travaPagina = useRef(false);
  const base = `/api/usuarios/${encodeURIComponent(usuarioId)}/atividades`;

  useEffect(() => {
    const controle = new AbortController();
    async function carregar() {
      try {
        const resposta = await fetch(`${base}?${parametros(consulta.filtros, consulta.cursor)}`, { signal: controle.signal, cache: "no-store" });
        const dados = await resposta.json() as PaginaAtividades | { erro: string };
        if (controle.signal.aborted) return;
        if (!resposta.ok || "erro" in dados) {
          if (resposta.status === 403) { cancelamentoDetalhe.current?.abort(); setPagina(null); setSelecionado(null); setDetalhe(null); }
          setErro(resposta.status === 403 ? "Seu perfil não permite consultar este histórico." : "Não foi possível carregar as atividades. Tente novamente.");
          setEstado(resposta.status === 403 ? "negado" : "erro");
          return;
        }
        setPagina(atual => consulta.cursor && atual ? { ...dados, inicioCobertura: atual.inicioCobertura ?? dados.inicioCobertura, eventos: [...atual.eventos, ...dados.eventos] } : dados);
        setEstado("pronto");
      } catch {
        if (!controle.signal.aborted) { setErro("Não foi possível carregar as atividades. Tente novamente."); setEstado("erro"); }
      } finally { if (!controle.signal.aborted) travaPagina.current = false; }
    }
    void carregar();
    return () => controle.abort();
  }, [base, consulta]);
  useEffect(() => () => cancelamentoDetalhe.current?.abort(), []);

  function aplicar(filtros: Filtros) {
    if (!filtros.de || !filtros.ate || filtros.de > filtros.ate) { setErro("Informe um período válido: a data inicial deve ser anterior ou igual à final."); return; }
    cancelamentoDetalhe.current?.abort();
    setSelecionado(null); setDetalhe(null); setPagina(null); setErro(""); setEstado("carregando");
    setConsulta(atual => ({ filtros, revisao: atual.revisao + 1, cursor: undefined }));
  }
  function carregarMais() {
    if (!pagina?.proximoCursor || travaPagina.current) return;
    travaPagina.current = true; setEstado("carregando"); setErro("");
    setConsulta(atual => ({ ...atual, revisao: atual.revisao + 1, cursor: pagina.proximoCursor! }));
  }
  async function abrirDetalhe(id: string) {
    cancelamentoDetalhe.current?.abort();
    if (selecionado === id && estadoDetalhe !== "erro") { setSelecionado(null); setDetalhe(null); return; }
    const controle = new AbortController(); cancelamentoDetalhe.current = controle;
    setSelecionado(id); setDetalhe(null); setErroDetalhe(""); setEstadoDetalhe("carregando");
    try {
      const resposta = await fetch(`${base}/${encodeURIComponent(id)}`, { signal: controle.signal, cache: "no-store" });
      const dados = await resposta.json() as DetalheAtividade | { erro: string };
      if (controle.signal.aborted) return;
      if (!resposta.ok || "erro" in dados) {
        setErroDetalhe(resposta.status === 403 ? "Seu perfil não permite consultar os detalhes deste evento." : "Não foi possível carregar os detalhes. Tente novamente.");
        setEstadoDetalhe(resposta.status === 403 ? "negado" : "erro"); return;
      }
      setDetalhe(dados); setEstadoDetalhe("pronto");
    } catch { if (!controle.signal.aborted) { setErroDetalhe("Não foi possível carregar os detalhes. Tente novamente."); setEstadoDetalhe("erro"); } }
  }
  const alterar = (campo: keyof Filtros, valor: string) => setRascunho(atual => ({ ...atual, [campo]: valor }));
  return <section aria-label={`Atividades de ${nomeUsuario}`} className="min-w-0 space-y-4">
    <div className="flex items-start gap-3"><History className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="font-semibold">Atividades de {nomeUsuario}</h3><p className="mt-1 text-xs text-muted-foreground">Mais recentes primeiro · 50 eventos por carregamento · Horário de São Paulo</p></div></div>
    <Card size="sm"><CardContent><form aria-label="Filtros de atividades" className="space-y-3" onSubmit={e => { e.preventDefault(); aplicar(rascunho); }}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">Mostrar<SelecaoFormulario value={rascunho.perspectiva} onValueChange={v => alterar("perspectiva", v)}><option value="autor">Atividades realizadas pelo usuário</option><option value="cadastro">Alterações no cadastro do usuário</option></SelecaoFormulario></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">De<Input type="date" required maxLength={10} value={rascunho.de} max={rascunho.ate || undefined} onChange={e => alterar("de", e.target.value)} /></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">Até<Input type="date" required maxLength={10} value={rascunho.ate} min={rascunho.de || undefined} onChange={e => alterar("ate", e.target.value)} /></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">Módulo<SelecaoFormulario value={rascunho.modulo ?? ""} onValueChange={v => alterar("modulo", v)}><option value="">Todos os módulos permitidos</option>{MODULOS.map(m => <option key={m} value={m}>{nome(m)}</option>)}</SelecaoFormulario></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">Ação<Input maxLength={100} placeholder="Todas as ações" value={rascunho.acao ?? ""} onChange={e => alterar("acao", e.target.value.replace(/[^\p{L}\p{N}_. /-]/gu, "").slice(0, 100))} /></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">Resultado<SelecaoFormulario value={rascunho.resultado ?? ""} onValueChange={v => alterar("resultado", v)}><option value="">Todos os resultados</option>{RESULTADOS.map(r => <option key={r} value={r}>{nome(r)}</option>)}</SelecaoFormulario></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">Origem<SelecaoFormulario value={rascunho.origem ?? ""} onValueChange={v => alterar("origem", v)}><option value="">Todas as origens</option>{ORIGENS.map(o => <option key={o} value={o}>{nome(o)}</option>)}</SelecaoFormulario></label>
      </div>
      <GrupoAcoes nome="Aplicar filtros de atividades" className="flex-wrap"><Button type="button" variant="outline" onClick={() => { const inicial = periodoInicial(); setRascunho(inicial); aplicar(inicial); }}>Últimos 30 dias</Button><Button type="submit">Aplicar filtros</Button></GrupoAcoes>
    </form></CardContent></Card>
    <p className="text-xs text-muted-foreground">{consulta.filtros.perspectiva === "cadastro" ? "Alterações no cadastro desta pessoa. O autor de cada alteração aparece no evento." : "Operações realizadas por esta pessoa. Alterações feitas por outras pessoas no seu cadastro estão na opção Alterações no cadastro."}</p>
    {pagina?.inicioCobertura && <p className="text-xs text-muted-foreground">Primeiro registro disponível: {dataHora(pagina.inicioCobertura)}. A cobertura varia por módulo e fonte de auditoria.</p>}
    {erro && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[var(--ds-cartao-raio)] border p-3"><p className="min-w-0 flex-1 text-sm text-destructive">{erro}</p>{estado === "erro" && <Button type="button" variant="outline" onClick={() => { setErro(""); setEstado("carregando"); setConsulta(atual => ({ ...atual, revisao: atual.revisao + 1 })); }}>Tentar novamente</Button>}</div>}
    {pagina?.eventos.length ? <Table aria-label="Histórico de atividades" identificationColumn={1}><TableHeader><TableRow><TableHead className="hidden sm:table-cell">Data e hora</TableHead><TableHead>Atividade</TableHead><TableHead><span className="sr-only">Detalhes</span></TableHead></TableRow></TableHeader><TableBody>{pagina.eventos.map(evento => <Fragment key={evento.id}>
      <TableRow><TableCell className="hidden align-top sm:table-cell"><time dateTime={evento.data} className="whitespace-nowrap text-xs">{dataHora(evento.data)}</time></TableCell><TableCell className="min-w-0"><p className="break-words font-medium">{evento.resumo}</p><time dateTime={evento.data} className="mt-1 block text-xs text-muted-foreground sm:hidden">{dataHora(evento.data)}</time><p className="mt-1 break-words text-xs text-muted-foreground">{nome(evento.modulo)} · {evento.acao} · {nome(evento.origem)}</p><p className="mt-1 break-words text-xs text-muted-foreground">Autor: {evento.autor} · {nome(evento.atorTipo)}</p><Badge variant={evento.resultado === "FALHA" || evento.resultado === "NEGADO" ? "destructive" : evento.resultado === "SOLICITADO" ? "warning" : "muted"} className="mt-2">{nome(evento.resultado)}</Badge></TableCell><TableCell className="align-top"><Button type="button" variant="ghost" size="sm" aria-label={`${selecionado === evento.id ? "Recolher" : "Ver"} detalhes de ${evento.resumo}`} aria-expanded={selecionado === evento.id} aria-controls={`detalhe-${evento.id}`} onClick={() => void abrirDetalhe(evento.id)}>{selecionado === evento.id ? "Recolher" : "Detalhes"}</Button></TableCell></TableRow>
      {selecionado === evento.id && <TableRow><TableCell colSpan={3}><div id={`detalhe-${evento.id}`} role="region" aria-label={`Detalhes de ${evento.resumo}`} className="space-y-3 py-2">
        {estadoDetalhe === "carregando" && <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando detalhes…</p>}
        {erroDetalhe && <div role="alert"><p className="text-destructive">{erroDetalhe}</p>{estadoDetalhe === "erro" && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void abrirDetalhe(evento.id)}>Tentar carregar detalhes</Button>}</div>}
        {detalhe && <><p className="text-xs text-muted-foreground">Registro: {nome(detalhe.evento.entidade)}</p>{detalhe.alteracoes.length ? <Table aria-label="Alterações permitidas" identificationColumn={0}><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Antes</TableHead><TableHead>Depois</TableHead></TableRow></TableHeader><TableBody>{detalhe.alteracoes.map((a, i) => <TableRow key={`${a.campo}-${i}`}><TableCell>{a.campo}</TableCell><TableCell className="whitespace-pre-wrap break-words">{a.antes || "—"}</TableCell><TableCell className="whitespace-pre-wrap break-words">{a.depois || "—"}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-xs text-muted-foreground">Não há diferenças de campos disponíveis para seu acesso neste evento.</p>}{!detalhe.referenciaDisponivel && <p className="text-xs text-muted-foreground">O registro de origem não está mais disponível. A evidência desta atividade foi preservada.</p>}{detalhe.link && detalhe.link.startsWith("/") && !detalhe.link.startsWith("//") && <Button type="button" variant="outline" size="sm" render={<a href={detalhe.link} />}><ExternalLink className="size-4" />Abrir registro</Button>}</>}
      </div></TableCell></TableRow>}
    </Fragment>)}</TableBody></Table> : estado === "pronto" && <Card size="sm"><CardContent><p role="status" className="py-5 text-center text-muted-foreground">Nenhuma atividade disponível para o período e os filtros selecionados.</p></CardContent></Card>}
    {estado === "carregando" && <p role="status" className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando atividades…</p>}
    {pagina && estado !== "negado" && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{pagina.eventos.length} {pagina.eventos.length === 1 ? "evento carregado" : "eventos carregados"}</p>{pagina.proximoCursor && <Button type="button" variant="outline" disabled={estado === "carregando"} onClick={carregarMais}>Carregar mais 50</Button>}</div>}
  </section>;
}
