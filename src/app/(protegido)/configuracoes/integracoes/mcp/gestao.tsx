"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AppWindow, Blocks, Bot, Cable, Check, CircleDashed, Clock, Copy, History, LayoutGrid, Minus, Plus, ShieldCheck, Stethoscope, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusAtivo } from "@/components/status-ativo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CampoBusca } from "@/components/campo-busca";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import type { DadosAdministracaoMcp, OperacaoMcp } from "@/lib/mcp/administracao";
import { FUNCOES_MCP, LIMITES_MCP, exigenciasDaFuncaoMcp } from "@/lib/mcp/catalogo";
import { IconeTom, TONS, TONS_DESTAQUE, type Tom } from "../tons";
import { diagnosticarMcpAction, salvarMcpAction } from "./actions";

type Autorizacao = DadosAdministracaoMcp["autorizacoes"][number];
type VarianteSelo = "success" | "warning" | "muted" | "destructive" | "secondary";
type Confirmacao = { titulo: string; descricao: string; operacao: OperacaoMcp; destrutiva: boolean };

const dataHora = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "Ainda não registrado";
const normalizarBusca = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
const nomesDiagnostico: Record<string, string> = { banco: "Banco de dados", empresa: "Empresa", perfis: "Perfis centrais do HUB", permissoes: "Permissões", descoberta: "Configuração da descoberta", metadadosHttp: "Descoberta pelo endereço publicado", bloqueioSemToken: "Bloqueio de chamadas sem credencial", acesso: "Acesso MCP", consultaFinanceira: "Consulta financeira", clienteExterno: "Consulta pelo cliente externo" };
const valoresDiagnostico: Record<string, string> = { OK: "Verificado", FALHA: "Falhou", AUSENTE: "Ausente", AUSENTES: "Ausentes", ATIVO: "Ativo", SUSPENSO: "Suspenso", CENTRAIS: "Centrais do HUB", NAO_EXECUTADA: "Não executada", NAO_TESTADO: "Não testada" };
const SITUACOES: Record<string, { rotulo: string; variante: VarianteSelo; tom: Tom }> = {
  ATIVA: { rotulo: "Ativa", variante: "success", tom: "verde" },
  PREPARADA: { rotulo: "Aguardando autorização", variante: "warning", tom: "ambar" },
  SUSPENSA: { rotulo: "Suspensa", variante: "muted", tom: "neutro" },
  REVOGADA: { rotulo: "Revogada", variante: "destructive", tom: "vermelho" },
};
const RESULTADOS: Record<string, { rotulo: string; variante: VarianteSelo }> = {
  OK: { rotulo: "Concluído", variante: "success" }, NEGADO: { rotulo: "Negado", variante: "warning" }, insufficient_scope: { rotulo: "Sem permissão", variante: "warning" },
  INCOMPLETO: { rotulo: "Incompleto", variante: "warning" }, invalid_token: { rotulo: "Credencial inválida", variante: "destructive" }, ERRO: { rotulo: "Erro", variante: "destructive" },
};
const MODULOS = [...new Set(FUNCOES_MCP.map(f => f.modulo as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
const tomDoModulo = (modulo: string): Tom => TONS_DESTAQUE[Math.max(0, MODULOS.indexOf(modulo)) % TONS_DESTAQUE.length];
const TOTAL_ACOES = FUNCOES_MCP.filter(f => f.escrita).length;

function Campo({ titulo, children }: { titulo: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium">{titulo}{children}</label>; }

function Metrica({ tom, icone, rotulo, valor, detalhe }: { tom: Tom; icone: ReactNode; rotulo: string; valor: ReactNode; detalhe?: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-[var(--ds-cartao-raio)] border border-border/80 bg-card p-4 shadow-sm">
    <IconeTom tom={tom}>{icone}</IconeTom>
    <div className="min-w-0"><p className="text-xs text-muted-foreground">{rotulo}</p><p className="truncate font-heading text-title tabular-nums">{valor}</p>{detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}</div>
  </div>;
}

function Restricao({ nome, titulo, inicial }: { nome: string; titulo: string; inicial: string[] | null }) {
  const [modo, setModo] = useState(inicial === null ? "todas" : inicial.length ? "lista" : "nenhuma");
  const id = useId();
  return <div className="space-y-2">
    <Campo titulo={titulo}><SelecaoFormulario name={`${nome}Modo`} value={modo} onValueChange={setModo}><option value="todas">Todas as permitidas no HUB</option><option value="lista">Somente os identificadores informados</option><option value="nenhuma">Nenhuma</option></SelecaoFormulario></Campo>
    <label htmlFor={id} className="text-xs text-muted-foreground">Identificadores internos separados por vírgula, até 200</label>
    <Input id={id} name={nome} defaultValue={inicial?.join(", ") ?? ""} maxLength={24000} disabled={modo !== "lista"} required={modo === "lista"} onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z0-9:_\-,\s]/g, ""); }} />
  </div>;
}
function lerRestricao(form: FormData, nome: string) { const modo = form.get(`${nome}Modo`); return modo === "todas" ? null : modo === "nenhuma" ? [] : String(form.get(nome) ?? "").split(",").map(s => s.trim()).filter(Boolean); }

export function GestaoMcp({ dados, editar, verUsuarios = false, abaInicial = "visao" }: { dados: DadosAdministracaoMcp; editar: boolean; verUsuarios?: boolean; abaInicial?: string }) {
  const router = useRouter(); const trava = useRef(false);
  const [aba, setAba] = useState(abaInicial);
  const [pendente, setPendente] = useState(false); const [erro, setErro] = useState("");
  const [modal, setModal] = useState<"cliente" | "autorizacao" | null>(null);
  const [autorizacao, setAutorizacao] = useState<Autorizacao | null>(null);
  const [usuarioId, setUsuarioId] = useState("");
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [periodo, setPeriodo] = useState({ de: dados.filtros.de ?? "", ate: dados.filtros.ate ?? "" }); const [ferramenta, setFerramenta] = useState(dados.filtros.ferramenta ?? ""); const [resultado, setResultado] = useState<string>(dados.filtros.resultado ?? "");
  const [buscaCatalogo, setBuscaCatalogo] = useState(""); const [moduloCatalogo, setModuloCatalogo] = useState(""); const [tipoCatalogo, setTipoCatalogo] = useState("");

  const catalogoFiltrado = FUNCOES_MCP.filter(f => (!moduloCatalogo || f.modulo === moduloCatalogo) && (!tipoCatalogo || String(f.escrita) === tipoCatalogo) && normalizarBusca(`${f.titulo} ${f.nome} ${f.modulo} ${f.descricao}`).includes(normalizarBusca(buscaCatalogo)));
  const modulosFiltrados = MODULOS.filter(m => catalogoFiltrado.some(f => f.modulo === m));
  const ativas = dados.autorizacoes.filter(a => a.situacao === "ATIVA").length;
  const vigentes = dados.autorizacoes.filter(a => a.situacao !== "REVOGADA").length;
  const ultimoUso = dados.autorizacoes.map(a => a.ultimoUsoEm).filter((s): s is string => !!s).sort().at(-1) ?? null;
  const diagnostico = dados.diagnostico && typeof dados.diagnostico === "object" ? dados.diagnostico as Record<string, unknown> : null;
  const diagnosticoAprovado = !!diagnostico && ["banco", "empresa", "descoberta", "metadadosHttp", "bloqueioSemToken"].every(chave => diagnostico[chave] === "OK");
  const resumoDiagnostico = !diagnostico ? "Ainda não executado" : diagnosticoAprovado ? "Verificações técnicas aprovadas; cliente externo não testado" : "Há verificações pendentes ou com falha";
  const estado: { rotulo: string; variante: VarianteSelo; icone: ReactNode } = !dados.configurado ? { rotulo: "Configuração pendente", variante: "warning", icone: <CircleDashed /> }
    : !dados.ativo ? { rotulo: "Acesso suspenso", variante: "muted", icone: <Minus /> }
    : ativas ? { rotulo: "Conectado", variante: "success", icone: <Check /> }
    : { rotulo: "Sem conexão ativa", variante: "secondary", icone: <Cable /> };

  async function executar(acao: () => Promise<{ ok: true } | { erro: string }>, mensagem = "Alteração confirmada.") {
    if (trava.current) return; trava.current = true; setPendente(true); setErro("");
    try { const r = await acao(); if ("erro" in r) setErro(r.erro); else { setModal(null); setConfirmacao(null); toast.success(mensagem); router.refresh(); } }
    catch { setErro("Não foi possível confirmar. Atualize a página antes de tentar novamente."); }
    finally { trava.current = false; setPendente(false); }
  }
  async function copiar(texto: string, mensagem: string) {
    try { await navigator.clipboard.writeText(texto); toast.success(mensagem); }
    catch { setErro("Não foi possível copiar. Selecione e copie o conteúdo do campo."); }
  }
  function abrirCliente() { setErro(""); setModal("cliente"); }
  function abrirAutorizacao(a: Autorizacao | null) { setAutorizacao(a); setUsuarioId(a?.usuarioId ?? ""); setErro(""); setModal("autorizacao"); }
  const filtro = (pagina: number) => { const p = new URLSearchParams({ pagina: String(pagina), aba: "historico" }); if (periodo.de) p.set("de", periodo.de); if (periodo.ate) p.set("ate", periodo.ate); if (ferramenta) p.set("ferramenta", ferramenta); if (resultado) p.set("resultado", resultado); return `?${p}`; };
  const permissoes = (s: string[]) => FUNCOES_MCP.filter(f => s.includes(f.escopo)).map(f => f.titulo).join(", ") || "Nenhuma";

  const passos: { titulo: string; descricao: string; feito: boolean; acao?: ReactNode }[] = [
    { titulo: "Cadastre a aplicação", feito: dados.clientes.length > 0,
      descricao: "No ChatGPT, abra Plugins e a opção de adicionar um servidor MCP personalizado. Informe o endereço acima, selecione OAuth e copie o redirecionamento exato mostrado. O nome informado aqui é apenas uma referência.",
      acao: <Button size="sm" variant="outline" disabled={!editar} onClick={abrirCliente}><Plus className="size-4" />Cadastrar aplicação</Button> },
    { titulo: "Prepare a autorização do responsável", feito: vigentes > 0,
      descricao: "Informe no ChatGPT o identificador de cliente gerado pelo HUB (cliente público, sem segredo) e prepare a política do usuário que fará a autorização.",
      acao: <><Button size="sm" variant="outline" disabled={!editar || !dados.clientes.length} onClick={() => abrirAutorizacao(null)}><Plus className="size-4" />Preparar autorização</Button><Button size="sm" variant="ghost" onClick={() => setAba("conexoes")}>Ver identificadores</Button></> },
    { titulo: "Autorize pelo assistente", feito: ativas > 0 || !!ultimoUso,
      descricao: "Conclua o fluxo de conexão: entre no HUB, confira aplicação, destino, funções e limites e autorize. Somente o responsável pode consentir." },
    { titulo: "Faça a primeira consulta", feito: !!ultimoUso,
      descricao: "Execute uma consulta real pelo ChatGPT e confira o resultado e o identificador no Histórico. Só então considere o cliente testado.",
      acao: <Button size="sm" variant="ghost" onClick={() => setAba("historico")}>Abrir histórico</Button> },
  ];
  const passoAtual = passos.findIndex(p => !p.feito);

  return <div className="space-y-6">
    <Card className="bg-linear-to-br from-secondary/70 via-card to-card">
      <CardContent className="flex flex-wrap items-center gap-4">
        <IconeTom tom="azul" tamanho="grande" className="bg-primary text-primary-foreground"><Bot /></IconeTom>
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="font-heading text-title break-words">MCP do Grazing HUB</h2>
          <p className="text-sm text-muted-foreground">Consultas e ações de negócio para assistentes de IA, com permissões herdadas do HUB.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={estado.variante}>{estado.icone}{estado.rotulo}</Badge>
          <span className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Acesso global</span>
            <StatusAtivo ativo={dados.ativo} nome="Acesso global MCP" disabled={!editar || pendente} onChange={ativo => setConfirmacao({ destrutiva: !ativo, titulo: ativo ? "Ativar acesso MCP?" : "Suspender todo o acesso MCP?", descricao: ativo ? "As políticas e os consentimentos continuam obrigatórios. Esta ação não autoriza aplicações automaticamente." : "Novas chamadas e emissões de credenciais serão bloqueadas. A operação normal do HUB continuará disponível.", operacao: { tipo: "global", ativo } })} /></span>
          <Button variant="outline" disabled={pendente} onClick={() => executar(diagnosticarMcpAction, "Diagnóstico concluído.")}><Stethoscope className="size-4" />Executar diagnóstico</Button>
        </div>
      </CardContent>
    </Card>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metrica tom="verde" icone={<ShieldCheck />} rotulo="Conexões ativas" valor={ativas} detalhe={`${vigentes} ${vigentes === 1 ? "autorização vigente" : "autorizações vigentes"}`} />
      <Metrica tom="roxo" icone={<AppWindow />} rotulo="Aplicações cadastradas" valor={dados.clientes.length} detalhe="Clientes OAuth públicos" />
      <Metrica tom="azul" icone={<Blocks />} rotulo="Funções disponíveis" valor={FUNCOES_MCP.length} detalhe={`${FUNCOES_MCP.length - TOTAL_ACOES} consultas · ${TOTAL_ACOES} ações`} />
      <Metrica tom="ambar" icone={<Clock />} rotulo="Última consulta concluída" valor={ultimoUso ? dataHora(ultimoUso) : "Sem uso"} detalhe={ultimoUso ? "Há uso registrado; confira aplicação e histórico" : "Nenhuma consulta externa registrada"} />
    </div>

    <Tabs value={aba} onValueChange={valor => setAba(String(valor))}>
      <TabsList><TabsTrigger className="flex-none" value="visao"><LayoutGrid />Visão geral</TabsTrigger><TabsTrigger className="flex-none" value="conexoes"><Cable />Conexões</TabsTrigger><TabsTrigger className="flex-none" value="funcoes"><Blocks />Funções disponíveis</TabsTrigger><TabsTrigger className="flex-none" value="historico"><History />Histórico e diagnóstico</TabsTrigger></TabsList>

      <TabsContent value="visao" className="space-y-4">
        <Card><CardHeader><CardTitle>Endereço do servidor</CardTitle><CardDescription>Use este endereço ao adicionar o Grazing HUB como servidor MCP no assistente.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1 basis-64"><Campo titulo="Endereço técnico do servidor"><Input readOnly value={dados.endereco} className="font-mono" /></Campo></div><Button onClick={() => copiar(dados.endereco, "Endereço copiado.")}><Copy className="size-4" />Copiar endereço</Button></div>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Ambiente</dt><dd>{dados.ambiente}</dd></div>
            <div><dt className="text-muted-foreground">Estrutura no banco</dt><dd>{dados.configurado ? "Disponível" : "Configuração pendente"}</dd></div>
            <div><dt className="text-muted-foreground">Último diagnóstico</dt><dd>{resumoDiagnostico}<div className="text-xs text-muted-foreground">{dataHora(dados.diagnosticadoEm)}</div></dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">O diagnóstico local não confirma autenticação nem consulta pelo ChatGPT. Credenciais expiram em uma hora; esta versão exige nova autorização, sem renovação automática.</p>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Conectar ao ChatGPT</CardTitle><CardDescription>Cadastro, consentimento e uso externo são etapas distintas. Acompanhe o que já foi concluído.</CardDescription></CardHeader><CardContent className="space-y-4">
          <ol className="space-y-3">{passos.map((p, i) => { const atual = i === passoAtual; return <li key={p.titulo} aria-current={atual ? "step" : undefined} className={cn("flex min-w-0 gap-3 rounded-[var(--ds-cartao-raio)] border p-3", atual ? "border-primary/40 bg-secondary/40" : "border-border/80")}>
            <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", p.feito ? TONS.verde : atual ? "bg-primary text-primary-foreground" : TONS.neutro)}>{p.feito ? <Check className="size-4" /> : i + 1}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{p.titulo}</p><Badge variant={p.feito ? "success" : atual ? "secondary" : "muted"}>{p.feito ? "Concluído" : atual ? "Próximo passo" : "Pendente"}</Badge></div>
              <p className="text-sm text-muted-foreground">{p.descricao}</p>
              {p.acao && <GrupoAcoes nome={`Ações de ${p.titulo}`} alinhamento="inicio" className="flex-wrap">{p.acao}</GrupoAcoes>}
            </div>
          </li>; })}</ol>
          <p className="text-sm text-muted-foreground">A disponibilidade da criação de integrações depende do plano e das políticas do workspace. <a className="text-primary underline" href="https://developers.openai.com/plugins/build/auth" target="_blank" rel="noreferrer">Documentação oficial de autenticação</a></p>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="conexoes" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-sm text-muted-foreground">Preparar uma política não concede consentimento. Somente o responsável pode autorizar no OAuth. Administrar conexões não concede acesso aos módulos. Perfil e permissões herdados de Usuários e permissões.</p>
          <GrupoAcoes className="ml-auto flex-wrap"><Button variant="outline" disabled={!editar} onClick={abrirCliente}><Plus className="size-4" />Cadastrar aplicação</Button><Button disabled={!editar || !dados.clientes.length} onClick={() => abrirAutorizacao(null)}><Plus className="size-4" />Preparar autorização</Button></GrupoAcoes>
        </div>
        {verUsuarios && <Button variant="link" render={<Link href="/configuracoes/usuarios" />}><Users className="size-4" />Administrar Usuários e permissões</Button>}

        <div className="grid gap-3 lg:grid-cols-2">{dados.autorizacoes.map(a => { const s = SITUACOES[a.situacao] ?? { rotulo: a.situacao, variante: "muted" as const, tom: "neutro" as const }; return <Card key={a.id} size="sm"><CardContent className="space-y-3">
          <div className="flex min-w-0 items-start gap-3">
            <IconeTom tom={s.tom}><Cable /></IconeTom>
            <div className="min-w-0 flex-1"><p className="font-medium break-words">{a.nome}</p><p className="text-xs text-muted-foreground break-words">{a.clienteNome}</p></div>
            <Badge variant={s.variante}>{s.rotulo}</Badge>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Usuário e perfil do HUB</dt><dd>{a.usuarioNome}<div className="text-xs text-muted-foreground">{a.perfilNome} · Empresa: {a.lojaNome}</div></dd></div>
            <div><dt className="text-xs text-muted-foreground">Criação / último uso</dt><dd className="text-xs">{dataHora(a.createdAt)}<div>{dataHora(a.ultimoUsoEm)}</div></dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Acesso autorizado para esta conexão</dt><dd className="text-xs break-words">{permissoes(a.efetivos)}<div className="text-muted-foreground">Consentido: {permissoes(a.escopos)}</div><div>Contas: {a.restricoes.contas === null ? "permitidas no HUB" : a.restricoes.contas.length}. Registros: {a.restricoes.lancamentos === null ? "permitidos no HUB" : a.restricoes.lancamentos.length}.</div></dd></div>
          </dl>
          <GrupoAcoes nome={`Ações de ${a.nome}`} className="flex-wrap">
            <Button size="sm" variant="outline" onClick={() => abrirAutorizacao(a)}>Detalhes</Button>
            {a.situacao !== "REVOGADA" && <>
              <Button size="sm" variant="outline" disabled={!editar || pendente} onClick={() => setConfirmacao({ destrutiva: a.situacao !== "SUSPENSA", titulo: a.situacao === "SUSPENSA" ? "Preparar nova autorização?" : "Suspender autorização?", descricao: "Credenciais existentes deixam de funcionar. Para voltar a consultar será necessário novo consentimento do responsável.", operacao: { tipo: "situacao", id: a.id, versao: a.versao, situacao: a.situacao === "SUSPENSA" ? "PREPARADA" : "SUSPENSA" } })}>{a.situacao === "SUSPENSA" ? "Repreparar" : "Suspender"}</Button>
              <Button size="sm" variant="saida-outline" disabled={!editar || pendente} onClick={() => setConfirmacao({ destrutiva: true, titulo: "Revogar autorização?", descricao: "A revogação é definitiva para esta autorização. Bloqueia credenciais e novas emissões, preservando o histórico. Para reconectar, crie outra política e conclua um novo OAuth.", operacao: { tipo: "situacao", id: a.id, versao: a.versao, situacao: "REVOGADA" } })}>Revogar</Button>
            </>}
          </GrupoAcoes>
        </CardContent></Card>; })}</div>
        {!dados.autorizacoes.length && <p className="text-sm text-muted-foreground">Nenhuma autorização preparada. Cadastre a aplicação e defina o responsável e a política.</p>}

        <Card><CardHeader><CardTitle>Aplicações cadastradas</CardTitle><CardDescription>O nome amigável não comprova a identidade do cliente. Redirecionamentos são comparados exatamente.</CardDescription></CardHeader><CardContent className="space-y-4">
          {dados.clientes.map(c => <div key={c.id} className="flex min-w-0 items-start gap-3 text-sm">
            <IconeTom tom="roxo"><AppWindow /></IconeTom>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><strong className="break-words">{c.nome}</strong><Badge variant={c.ativo ? "success" : "muted"}>{c.ativo ? "Ativa" : "Inativa"}</Badge></div>
              <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1 basis-64"><Campo titulo="Identificador de cliente"><Input readOnly value={c.id} className="font-mono" /></Campo></div><Button variant="outline" aria-label={`Copiar identificador de ${c.nome}`} onClick={() => copiar(c.id, "Identificador copiado.")}><Copy className="size-4" />Copiar</Button></div>
              <p className="break-all text-xs text-muted-foreground">{c.redirectUris.join(", ")}</p>
            </div>
          </div>)}
          {!dados.clientes.length && <p className="text-sm text-muted-foreground">Nenhuma aplicação cadastrada.</p>}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="funcoes" className="space-y-4">
        <p className="text-sm text-muted-foreground">Catálogo gerado a partir das funções do servidor. Cada função exige a ação central indicada, além do consentimento OAuth e da identidade válidos. Este catálogo não concede permissões.</p>
        <div className="flex flex-wrap items-end gap-3"><Campo titulo="Buscar função"><CampoBusca value={buscaCatalogo} onChange={setBuscaCatalogo} maxLength={160} aria-label="Buscar função" placeholder="Nome ou finalidade" /></Campo><Campo titulo="Módulo"><SelecaoFormulario value={moduloCatalogo} onValueChange={setModuloCatalogo}><option value="">Todos</option>{MODULOS.map(m => <option key={m} value={m}>{m}</option>)}</SelecaoFormulario></Campo><Campo titulo="Tipo de função"><SelecaoFormulario value={tipoCatalogo} onValueChange={setTipoCatalogo}><option value="">Todos</option><option value="false">Consultas</option><option value="true">Ações de negócio</option></SelecaoFormulario></Campo></div>
        <p role="status" className="text-sm text-muted-foreground">{catalogoFiltrado.length} funções encontradas.</p>
        {modulosFiltrados.map(modulo => { const funcoes = catalogoFiltrado.filter(f => f.modulo === modulo); return <Card key={modulo} size="sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><IconeTom tom={tomDoModulo(modulo)} tamanho="pequeno"><Blocks /></IconeTom>{modulo}<Badge variant="muted">{funcoes.length}</Badge></CardTitle></CardHeader>
          <CardContent><ul className="divide-y divide-border/80">{funcoes.map(f => <li key={f.nome} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{f.titulo}</p><Badge variant={f.escrita ? "warning" : "secondary"}>{f.escrita ? "Ação de negócio" : "Consulta"}</Badge><code className="rounded-[var(--ds-controle-raio)] bg-muted px-1.5 py-0.5 text-xs break-all">{f.nome}</code></div>
            <p className="text-sm text-muted-foreground">{f.descricao}</p>
            <p className="text-xs break-words">Permissão: {exigenciasDaFuncaoMcp(f).map(r => f.modulo !== "iFood" && r.recurso === "vendas.pedidos.producao" && r.acao === "editar" ? "Pedidos: operar pela Produção ou Revisão (Editar)" : `${r.recurso} → ${r.acao}`).join(" + ") || "Identidade OAuth própria"} · Escopo: <code className="break-all">{f.escopo}</code></p>
            <p className={cn("text-xs", f.confirmacao ? "text-warning" : "text-muted-foreground")}>{f.confirmacao ? "Revisão humana autenticada obrigatória" : "Sem confirmação adicional"}</p>
          </li>)}</ul></CardContent>
        </Card>; })}
        <p className="text-xs text-muted-foreground">Limites específicos no contrato de cada função; consultas paginadas de até {LIMITES_MCP.pagina} registros. Os relatórios financeiros limitam período e volume de origem. Restrições também valem para totais.</p>
      </TabsContent>

      <TabsContent value="historico" className="space-y-4">
        <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-2">Resultado do diagnóstico{diagnostico && <Badge variant={diagnosticoAprovado ? "success" : "warning"}>{diagnosticoAprovado ? "Verificações aprovadas" : "Requer atenção"}</Badge>}</CardTitle><CardDescription>{dataHora(dados.diagnosticadoEm)}. Verificações de banco, descoberta HTTP e bloqueio sem credencial; não executa consultas financeiras nem usa privilégios de outro usuário.</CardDescription></CardHeader><CardContent>
          {diagnostico ? <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">{Object.entries(diagnostico).map(([chave, valor]) => { const v = String(valor); const tom: Tom = v === "OK" || v === "ATIVO" ? "verde" : v === "FALHA" || v.startsWith("AUSENTE") ? "vermelho" : "neutro"; return <div key={chave} className="flex min-w-0 items-center gap-2">
            <IconeTom tom={tom} tamanho="pequeno">{tom === "verde" ? <Check /> : tom === "vermelho" ? <X /> : <Minus />}</IconeTom>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{nomesDiagnostico[chave] ?? chave}</dt><dd>{valoresDiagnostico[v] ?? v}</dd></div>
          </div>; })}</dl> : <p className="text-sm text-muted-foreground">Diagnóstico ainda não executado.</p>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><IconeTom tom="azul" tamanho="pequeno"><Activity /></IconeTom>Histórico de uso</CardTitle><CardDescription>Retenção técnica: {LIMITES_MCP.retencaoDias} dias, com limpeza em lotes durante uso e diagnóstico. Sem credenciais, argumentos ou respostas financeiras nos logs.</CardDescription></CardHeader><CardContent className="space-y-4">
          <FiltroPeriodo de={periodo.de} ate={periodo.ate} aoAlterar={setPeriodo} />
          <div className="flex flex-wrap items-end gap-3"><Campo titulo="Função"><SelecaoFormulario value={ferramenta} onValueChange={setFerramenta}><option value="">Todas</option>{FUNCOES_MCP.map(f => <option key={f.nome} value={f.nome}>{f.titulo}</option>)}</SelecaoFormulario></Campo><Campo titulo="Resultado"><SelecaoFormulario value={resultado} onValueChange={setResultado}><option value="">Todos</option><option value="OK">Concluído</option><option value="NEGADO">Negado</option><option value="invalid_token">Credencial inválida</option><option value="insufficient_scope">Sem permissão</option><option value="ERRO">Erro</option></SelecaoFormulario></Campo><Button variant="outline" render={<Link href={filtro(1)} />}>Aplicar filtros</Button></div>
          <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Responsável / aplicação</TableHead><TableHead>Evento / função</TableHead><TableHead>Resultado</TableHead><TableHead>Duração</TableHead><TableHead>Correlação</TableHead></TableRow></TableHeader><TableBody>{dados.eventos.map(e => { const r = RESULTADOS[e.resultado] ?? { rotulo: e.resultado, variante: "muted" as const }; return <TableRow key={e.id}><TableCell className="text-xs">{dataHora(e.createdAt)}</TableCell><TableCell>{dados.usuarios.find(u => u.id === e.usuarioId)?.nome ?? e.usuarioId ?? "Não autenticado"}<div className="text-xs text-muted-foreground">{dados.clientes.find(c => c.id === e.clienteId)?.nome ?? e.clienteId ?? "HUB"}</div></TableCell><TableCell className="text-xs">{e.acao}<div>{e.ferramenta}</div></TableCell><TableCell><Badge variant={r.variante}>{r.rotulo}</Badge></TableCell><TableCell>{e.duracaoMs} ms</TableCell><TableCell className="text-xs">{e.correlacao}</TableCell></TableRow>; })}</TableBody></Table>
          {!dados.eventos.length && <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>}
          <GrupoAcoes className="flex-wrap"><span className="text-sm text-muted-foreground">Página {dados.pagina} · {dados.totalEventos} eventos</span><Button variant="outline" disabled={dados.pagina <= 1} render={<Link href={filtro(Math.max(1, dados.pagina - 1))} />}>Anterior</Button><Button variant="outline" disabled={dados.pagina * 50 >= dados.totalEventos} render={<Link href={filtro(dados.pagina + 1)} />}>Próxima</Button></GrupoAcoes>
        </CardContent></Card>
      </TabsContent>
    </Tabs>

    <Dialog open={modal !== null} onOpenChange={aberto => { if (!aberto && !pendente) setModal(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{modal === "cliente" ? "Cadastrar aplicação" : "Conexão individual"}</DialogTitle><DialogDescription>{modal === "cliente" ? "Copie o redirecionamento exato da configuração OAuth do cliente. Nenhuma conexão é autorizada neste cadastro." : "Salvar invalida as credenciais atuais e exige novo consentimento do responsável. Nenhuma permissão do HUB é alterada."}</DialogDescription></DialogHeader>
      <form key={`${modal}:${autorizacao?.id ?? ""}`} className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const nome = String(f.get("nome") ?? ""); let op: unknown;
        if (modal === "cliente") op = { tipo: "cliente", nome, redirectUri: String(f.get("redirectUri") ?? "").trim() };
        else op = { tipo: "autorizacao", id: autorizacao?.id, versao: autorizacao?.versao, nome, clienteId: autorizacao?.clienteId ?? String(f.get("clienteId") ?? ""), usuarioId: autorizacao?.usuarioId ?? usuarioId, restricoes: { contas: lerRestricao(f, "contas"), lancamentos: lerRestricao(f, "lancamentos") } };
        void executar(() => salvarMcpAction(op));
      }}><fieldset disabled={!editar || pendente || (modal === "autorizacao" && autorizacao?.situacao === "REVOGADA")} className="space-y-4">
        <Campo titulo="Nome amigável"><Input name="nome" required minLength={3} maxLength={100} defaultValue={modal === "autorizacao" ? autorizacao?.nome : ""} /></Campo>
        {modal === "cliente" && <Campo titulo="Redirecionamento OAuth exato"><Input name="redirectUri" type="url" required maxLength={2048} autoComplete="off" /></Campo>}
        {modal === "autorizacao" && <><div className="grid gap-4 sm:grid-cols-2"><Campo titulo="Aplicação"><SelecaoFormulario name="clienteId" required disabled={!!autorizacao} defaultValue={autorizacao?.clienteId ?? ""}><option value="">Selecione</option>{dados.clientes.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo><Campo titulo="Responsável no HUB"><SelecaoFormulario name="usuarioId" required disabled={!!autorizacao} value={usuarioId} onValueChange={setUsuarioId}><option value="">Selecione</option>{dados.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</SelecaoFormulario></Campo></div><Campo titulo="Perfil do usuário no HUB"><Input readOnly value={autorizacao?.perfilNome ?? dados.usuarios.find(u => u.id === usuarioId)?.perfilAcesso?.nome ?? "Selecione o responsável"} /></Campo><p className="text-sm text-muted-foreground">Perfil e permissões herdados de Usuários e permissões.</p><Restricao nome="contas" titulo="Contas bancárias" inicial={autorizacao?.restricoes.contas ?? null} /><Restricao nome="lancamentos" titulo="Lançamentos" inicial={autorizacao?.restricoes.lancamentos ?? null} /><p className="text-xs text-muted-foreground">IDs inexistentes não concedem acesso. Restrições são aplicadas aos registros, contagens e totais. O escopo do token pode ser menor que a política.</p></>}
      </fieldset>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><Button variant="outline" type="button" disabled={pendente} onClick={() => setModal(null)}>Fechar</Button><Button type="submit" disabled={!editar || pendente || (modal === "autorizacao" && autorizacao?.situacao === "REVOGADA")}>{pendente ? "Salvando..." : "Salvar"}</Button></GrupoAcoes></form>
    </DialogContent></Dialog>
    <Dialog open={!!confirmacao} onOpenChange={aberto => { if (!aberto && !pendente) setConfirmacao(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmacao?.titulo}</DialogTitle><DialogDescription>{confirmacao?.descricao}</DialogDescription></DialogHeader>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><Button variant="outline" disabled={pendente} onClick={() => setConfirmacao(null)}>Cancelar</Button><Button variant={confirmacao?.destrutiva ? "saida" : "entrada"} disabled={pendente} onClick={() => confirmacao && executar(() => salvarMcpAction(confirmacao.operacao))}>{pendente ? "Confirmando..." : "Confirmar"}</Button></GrupoAcoes></DialogContent></Dialog>
  </div>;
}
