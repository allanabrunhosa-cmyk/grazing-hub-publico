"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AppWindow, Cable, Check, CircleAlert, Copy, Minus, Plus, Stethoscope, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CampoBusca } from "@/components/campo-busca";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import type { DadosAdministracaoMcp, OperacaoMcp } from "@/lib/mcp/administracao";
import { FUNCOES_MCP, LIMITES_MCP, exigenciasDaFuncaoMcp } from "@/lib/mcp/catalogo";
import { IconeTom, TONS, situacaoDaConexao, type Tom, type VarianteSelo } from "../tons";
import { diagnosticarMcpAction, salvarMcpAction } from "./actions";

type Autorizacao = DadosAdministracaoMcp["autorizacoes"][number];
type Confirmacao = { titulo: string; descricao: string; operacao: OperacaoMcp; destrutiva: boolean };

const dataHora = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "Ainda não registrado";
const normalizarBusca = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
const nomesDiagnostico: Record<string, string> = { banco: "Banco de dados", empresa: "Empresa", perfis: "Perfis centrais do HUB", permissoes: "Permissões", descoberta: "Configuração da descoberta", metadadosHttp: "Descoberta pelo endereço publicado", bloqueioSemToken: "Bloqueio de chamadas sem credencial", acesso: "Acesso MCP", consultaFinanceira: "Consulta financeira", clienteExterno: "Consulta pelo cliente externo" };
const valoresDiagnostico: Record<string, string> = { OK: "Verificado", FALHA: "Falhou", AUSENTE: "Ausente", AUSENTES: "Ausentes", ATIVO: "Ativo", SUSPENSO: "Suspenso", CENTRAIS: "Centrais do HUB", NAO_EXECUTADA: "Não executada", NAO_TESTADO: "Não testada" };
const RESULTADOS: Record<string, { rotulo: string; variante: VarianteSelo }> = {
  OK: { rotulo: "Concluído", variante: "success" }, NEGADO: { rotulo: "Negado", variante: "warning" }, insufficient_scope: { rotulo: "Sem permissão", variante: "warning" },
  INCOMPLETO: { rotulo: "Incompleto", variante: "warning" }, invalid_token: { rotulo: "Credencial inválida", variante: "destructive" }, ERRO: { rotulo: "Erro", variante: "destructive" },
};
const ESTADO_CONEXAO: Record<string, { titulo: string; descricao: string; icone: ReactNode }> = {
  ATIVA: { titulo: "Conexão ativa", descricao: "O responsável autorizou e as funções liberadas abaixo podem ser usadas pelo assistente.", icone: <Check /> },
  PREPARADA: { titulo: "Aguardando autorização", descricao: "A política está preparada. O responsável ainda precisa concluir a autorização pelo assistente.", icone: <CircleAlert /> },
  SUSPENSA: { titulo: "Conexão suspensa", descricao: "As credenciais deixaram de funcionar. Para voltar a usar, reprepare e peça nova autorização ao responsável.", icone: <Minus /> },
  REVOGADA: { titulo: "Conexão revogada", descricao: "Revogação definitiva, com histórico preservado. Para reconectar, crie uma nova conexão.", icone: <X /> },
};
const MODULOS = [...new Set(FUNCOES_MCP.map(f => f.modulo as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));

function Campo({ titulo, children }: { titulo: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium">{titulo}{children}</label>; }
function Dado({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) { return <div className={cn("min-w-0", className)}><dt className="text-xs text-muted-foreground">{titulo}</dt><dd className="break-words">{children}</dd></div>; }

/** Bloco do detalhe: rótulo curto, título e ações à direita, como nos cartões de Status e Conexão. */
function Secao({ rotulo, titulo, descricao, icone, tom = "neutro", acoes, children }: { rotulo: string; titulo: string; descricao?: ReactNode; icone?: ReactNode; tom?: Tom; acoes?: ReactNode; children?: ReactNode }) {
  return <Card><CardContent className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      {icone && <IconeTom tom={tom}>{icone}</IconeTom>}
      <div className="min-w-0 flex-1 basis-56"><p className="text-label uppercase text-muted-foreground">{rotulo}</p><h2 className="font-heading text-title break-words">{titulo}</h2>{descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}</div>
      {acoes && <GrupoAcoes nome={`Ações de ${titulo}`} className="ml-auto flex-wrap">{acoes}</GrupoAcoes>}
    </div>
    {children}
  </CardContent></Card>;
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

/** Funções do servidor. Com uma conexão, mostra o que está liberado para ela; sem conexão, é o catálogo completo. Não concede permissões. */
function Funcionalidades({ autorizacao }: { autorizacao: Autorizacao | null }) {
  const liberadas = autorizacao ? FUNCOES_MCP.filter(f => autorizacao.efetivos.includes(f.escopo)).length : 0;
  const [busca, setBusca] = useState(""); const [modulo, setModulo] = useState(""); const [tipo, setTipo] = useState("");
  const [situacao, setSituacao] = useState(liberadas ? "liberadas" : "");
  const estado = (escopo: string): { rotulo: string; variante: VarianteSelo; chave: string } => !autorizacao ? { rotulo: "", variante: "muted", chave: "" }
    : autorizacao.efetivos.includes(escopo) ? { rotulo: "Liberada", variante: "success", chave: "liberadas" }
    : autorizacao.disponiveis.includes(escopo) ? { rotulo: "Aguardando autorização", variante: "warning", chave: "pendentes" }
    : { rotulo: "Sem permissão no HUB", variante: "muted", chave: "bloqueadas" };
  const filtradas = FUNCOES_MCP.filter(f => (!modulo || f.modulo === modulo) && (!tipo || String(f.escrita) === tipo) && (!situacao || estado(f.escopo).chave === situacao) && normalizarBusca(`${f.titulo} ${f.nome} ${f.modulo} ${f.descricao}`).includes(normalizarBusca(busca)));
  return <Secao rotulo="Funcionalidades" titulo={autorizacao ? "Funções desta conexão" : "Catálogo de funções"}
    descricao={autorizacao ? `${liberadas} de ${FUNCOES_MCP.length} funções liberadas. Cada função depende da permissão do responsável no HUB e da autorização dele; esta lista não concede permissões.` : `${FUNCOES_MCP.length} funções do servidor. Cada função exige a ação central indicada, além do consentimento OAuth e da identidade válidos. Este catálogo não concede permissões.`}>
    <div className="flex flex-wrap items-end gap-3">
      <Campo titulo="Buscar função"><CampoBusca value={busca} onChange={setBusca} maxLength={160} aria-label="Buscar função" placeholder="Nome ou finalidade" /></Campo>
      {autorizacao && <Campo titulo="Situação"><SelecaoFormulario value={situacao} onValueChange={setSituacao}><option value="">Todas</option><option value="liberadas">Liberadas</option><option value="pendentes">Aguardando autorização</option><option value="bloqueadas">Sem permissão no HUB</option></SelecaoFormulario></Campo>}
      <Campo titulo="Módulo"><SelecaoFormulario value={modulo} onValueChange={setModulo}><option value="">Todos</option>{MODULOS.map(m => <option key={m} value={m}>{m}</option>)}</SelecaoFormulario></Campo>
      <Campo titulo="Tipo de função"><SelecaoFormulario value={tipo} onValueChange={setTipo}><option value="">Todos</option><option value="false">Consultas</option><option value="true">Ações de negócio</option></SelecaoFormulario></Campo>
    </div>
    <p role="status" className="text-sm text-muted-foreground">{filtradas.length} funções encontradas.</p>
    <ul className="divide-y divide-border/80">{filtradas.map(f => { const e = estado(f.escopo); return <li key={f.nome} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-72 space-y-1">
        <p className="font-medium">{f.titulo} <span className="font-normal text-muted-foreground">· {f.modulo} · {f.escrita ? "Ação de negócio" : "Consulta"}</span></p>
        <p className="text-sm text-muted-foreground">{f.descricao}</p>
        <p className="text-xs break-words text-muted-foreground"><code className="break-all text-foreground">{f.nome}</code> · Permissão: {exigenciasDaFuncaoMcp(f).map(r => f.modulo !== "iFood" && r.recurso === "vendas.pedidos.producao" && r.acao === "editar" ? "Pedidos: operar pela Produção ou Revisão (Editar)" : `${r.recurso} → ${r.acao}`).join(" + ") || "Identidade OAuth própria"}{f.confirmacao && <span className="text-warning"> · Revisão humana autenticada obrigatória</span>}</p>
      </div>
      {autorizacao && <Badge variant={e.variante}>{e.rotulo}</Badge>}
    </li>; })}</ul>
    {!filtradas.length && <p className="text-sm text-muted-foreground">Nenhuma função nesta seleção. Ajuste os filtros para ver as demais.</p>}
    <p className="text-xs text-muted-foreground">Limites específicos no contrato de cada função; consultas paginadas de até {LIMITES_MCP.pagina} registros. Os relatórios financeiros limitam período e volume de origem. Restrições também valem para totais.</p>
  </Secao>;
}

export function GestaoMcp({ dados, editar, verUsuarios = false, selecao }: { dados: DadosAdministracaoMcp; editar: boolean; verUsuarios?: boolean; selecao: string }) {
  const router = useRouter(); const trava = useRef(false);
  const [pendente, setPendente] = useState(false); const [erro, setErro] = useState("");
  const [modal, setModal] = useState<"cliente" | "autorizacao" | null>(null);
  const [autorizacao, setAutorizacao] = useState<Autorizacao | null>(null);
  const [usuarioId, setUsuarioId] = useState("");
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [periodo, setPeriodo] = useState({ de: dados.filtros.de ?? "", ate: dados.filtros.ate ?? "" }); const [ferramenta, setFerramenta] = useState(dados.filtros.ferramenta ?? ""); const [resultado, setResultado] = useState<string>(dados.filtros.resultado ?? "");

  const conexao = dados.autorizacoes.find(a => a.id === selecao) ?? null;
  const ativas = dados.autorizacoes.filter(a => a.situacao === "ATIVA").length;
  const vigentes = dados.autorizacoes.filter(a => a.situacao !== "REVOGADA").length;
  const ultimoUso = dados.autorizacoes.map(a => a.ultimoUsoEm).filter((s): s is string => !!s).sort().at(-1) ?? null;
  const diagnostico = dados.diagnostico && typeof dados.diagnostico === "object" ? dados.diagnostico as Record<string, unknown> : null;
  const diagnosticoAprovado = !!diagnostico && ["banco", "empresa", "descoberta", "metadadosHttp", "bloqueioSemToken"].every(chave => diagnostico[chave] === "OK");

  async function executar(acao: () => Promise<{ ok: true } | { erro: string }>, mensagem = "Alteração confirmada.") {
    if (trava.current) return; trava.current = true; setPendente(true); setErro("");
    try { const r = await acao(); if ("erro" in r) setErro(r.erro); else { setModal(null); setConfirmacao(null); toast.success(mensagem); router.refresh(); } }
    catch { setErro("Não foi possível confirmar. Atualize a página antes de tentar novamente."); }
    finally { trava.current = false; setPendente(false); }
  }
  async function copiar(texto: string, mensagem: string) {
    try { await navigator.clipboard.writeText(texto); toast.success(mensagem); }
    catch { setErro("Não foi possível copiar. Selecione e copie o conteúdo exibido."); }
  }
  function abrirCliente() { setErro(""); setModal("cliente"); }
  function abrirAutorizacao(a: Autorizacao | null) { setAutorizacao(a); setUsuarioId(a?.usuarioId ?? ""); setErro(""); setModal("autorizacao"); }
  const filtro = (pagina: number) => { const p = new URLSearchParams({ conexao: "servidor", pagina: String(pagina) }); if (periodo.de) p.set("de", periodo.de); if (periodo.ate) p.set("ate", periodo.ate); if (ferramenta) p.set("ferramenta", ferramenta); if (resultado) p.set("resultado", resultado); return `?${p}`; };

  function detalheDaConexao(a: Autorizacao) {
    const s = situacaoDaConexao(a.situacao); const e = ESTADO_CONEXAO[a.situacao] ?? { titulo: a.situacao, descricao: "", icone: <Minus /> };
    return <>
      <Secao rotulo="Status" titulo={e.titulo} descricao={e.descricao} icone={e.icone} tom={s.tom} acoes={a.situacao !== "REVOGADA" && <>
        <Button variant="outline" disabled={!editar || pendente} onClick={() => setConfirmacao({ destrutiva: a.situacao !== "SUSPENSA", titulo: a.situacao === "SUSPENSA" ? "Preparar nova autorização?" : "Suspender autorização?", descricao: "Credenciais existentes deixam de funcionar. Para voltar a consultar será necessário novo consentimento do responsável.", operacao: { tipo: "situacao", id: a.id, versao: a.versao, situacao: a.situacao === "SUSPENSA" ? "PREPARADA" : "SUSPENSA" } })}>{a.situacao === "SUSPENSA" ? "Repreparar" : "Suspender"}</Button>
        <Button variant="saida-outline" disabled={!editar || pendente} onClick={() => setConfirmacao({ destrutiva: true, titulo: "Revogar autorização?", descricao: "A revogação é definitiva para esta autorização. Bloqueia credenciais e novas emissões, preservando o histórico. Para reconectar, crie outra política e conclua um novo OAuth.", operacao: { tipo: "situacao", id: a.id, versao: a.versao, situacao: "REVOGADA" } })}>Revogar</Button>
      </>}>
        {!dados.ativo && a.situacao !== "REVOGADA" && <p className={cn("rounded-[var(--ds-controle-raio)] px-3 py-2 text-sm", TONS.ambar)}>O acesso global ao MCP está suspenso. Nenhuma conexão funciona até reativá-lo na faixa do servidor, acima.</p>}
      </Secao>
      <Secao rotulo="Conexão" titulo={a.nome} icone={<Cable />} tom="azul" acoes={<Button variant="outline" onClick={() => abrirAutorizacao(a)}>{a.situacao === "REVOGADA" ? "Ver restrições" : "Editar restrições"}</Button>}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dado titulo="Aplicação">{a.clienteNome}</Dado>
          <Dado titulo="Responsável no HUB">{a.usuarioNome}<div className="text-xs text-muted-foreground">{a.perfilNome} · {a.lojaNome}</div></Dado>
          <Dado titulo="Criada em">{dataHora(a.createdAt)}</Dado>
          <Dado titulo="Último uso">{dataHora(a.ultimoUsoEm)}</Dado>
          <Dado titulo="Identificador de cliente" className="sm:col-span-2"><span className="flex flex-wrap items-center gap-2"><code className="min-w-0 rounded-[var(--ds-controle-raio)] bg-muted px-2 py-1 text-xs break-all">{a.clienteId}</code><Button size="sm" variant="outline" aria-label={`Copiar identificador de ${a.clienteNome}`} onClick={() => copiar(a.clienteId, "Identificador copiado.")}><Copy className="size-4" />Copiar</Button></span></Dado>
          <Dado titulo="Contas bancárias">{a.restricoes.contas === null ? "Todas as permitidas no HUB" : `${a.restricoes.contas.length} informadas`}</Dado>
          <Dado titulo="Lançamentos">{a.restricoes.lancamentos === null ? "Todos os permitidos no HUB" : `${a.restricoes.lancamentos.length} informados`}</Dado>
        </dl>
        <p className="text-xs text-muted-foreground">Perfil e permissões herdados de Usuários e permissões. Credenciais expiram em uma hora; esta versão exige nova autorização, sem renovação automática.</p>
      </Secao>
      <Funcionalidades key={a.id} autorizacao={a} />
    </>;
  }

  function novaConexao() {
    const passos: { titulo: string; descricao: string; feito: boolean; acao?: ReactNode }[] = [
      { titulo: "Cadastre a aplicação", feito: dados.clientes.length > 0,
        descricao: "No ChatGPT, abra Plugins e a opção de adicionar um servidor MCP personalizado. Informe o endereço do servidor (faixa acima), selecione OAuth e copie o redirecionamento exato mostrado. Em aplicativos instalados no computador, use a URL de retorno que o aplicativo exibe (http://127.0.0.1 com a porta). O nome informado aqui é apenas uma referência.",
        acao: <Button size="sm" variant="outline" disabled={!editar} onClick={abrirCliente}><Plus className="size-4" />Cadastrar aplicação</Button> },
      { titulo: "Prepare a autorização do responsável", feito: vigentes > 0,
        descricao: "Informe no ChatGPT o identificador de cliente gerado pelo HUB (cliente público, sem segredo) e prepare a política do usuário que fará a autorização.",
        acao: <><Button size="sm" variant="outline" disabled={!editar || !dados.clientes.length} onClick={() => abrirAutorizacao(null)}><Plus className="size-4" />Preparar autorização</Button><Button size="sm" variant="ghost" render={<Link href="?conexao=servidor" />}>Ver identificadores</Button></> },
      { titulo: "Autorize pelo assistente", feito: ativas > 0 || !!ultimoUso,
        descricao: "Conclua o fluxo de conexão: entre no HUB, confira aplicação, destino, funções e limites e autorize. Somente o responsável pode consentir." },
      { titulo: "Faça a primeira consulta", feito: !!ultimoUso,
        descricao: "Execute uma consulta real pelo ChatGPT e confira o resultado e o identificador no histórico do servidor. Só então considere o cliente testado." },
    ];
    const passoAtual = passos.findIndex(p => !p.feito);
    return <Secao rotulo="Nova conexão" titulo="Conectar um assistente de IA" icone={<Plus />} tom="azul" descricao="Cadastro, consentimento e uso externo são etapas distintas. Acompanhe o que já foi concluído.">
      <ol className="space-y-3">{passos.map((p, i) => { const atual = i === passoAtual; return <li key={p.titulo} aria-current={atual ? "step" : undefined} className={cn("flex min-w-0 gap-3 rounded-[var(--ds-cartao-raio)] border p-3", atual ? "border-primary/40 bg-secondary/40" : "border-border/80")}>
        <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", p.feito ? TONS.verde : atual ? "bg-primary text-primary-foreground" : TONS.neutro)}>{p.feito ? <Check className="size-4" /> : i + 1}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{p.titulo}</p><Badge variant={p.feito ? "success" : atual ? "secondary" : "muted"}>{p.feito ? "Concluído" : atual ? "Próximo passo" : "Pendente"}</Badge></div>
          <p className="text-sm text-muted-foreground">{p.descricao}</p>
          {p.acao && <GrupoAcoes nome={`Ações de ${p.titulo}`} alinhamento="inicio" className="flex-wrap">{p.acao}</GrupoAcoes>}
        </div>
      </li>; })}</ol>
      <p className="text-sm text-muted-foreground">Preparar uma política não concede consentimento. A disponibilidade da criação de integrações depende do plano e das políticas do workspace. <a className="text-primary underline" href="https://developers.openai.com/plugins/build/auth" target="_blank" rel="noreferrer">Documentação oficial de autenticação</a></p>
    </Secao>;
  }

  function servidor() {
    return <>
      <Secao rotulo="Diagnóstico" titulo={!diagnostico ? "Diagnóstico ainda não executado" : diagnosticoAprovado ? "Verificações técnicas aprovadas" : "Há verificações pendentes ou com falha"} icone={<Stethoscope />} tom={!diagnostico ? "neutro" : diagnosticoAprovado ? "verde" : "ambar"}
        descricao={`${dataHora(dados.diagnosticadoEm)} · ${dados.ambiente}. Confere banco, descoberta HTTP e bloqueio sem credencial; não confirma autenticação nem consulta pelo cliente externo.`}
        acoes={<Button variant="outline" disabled={pendente} onClick={() => executar(diagnosticarMcpAction, "Diagnóstico concluído.")}><Stethoscope className="size-4" />Executar diagnóstico</Button>}>
        {diagnostico && <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">{Object.entries(diagnostico).map(([chave, valor]) => { const v = String(valor); const tom: Tom = v === "OK" || v === "ATIVO" ? "verde" : v === "FALHA" || v.startsWith("AUSENTE") ? "vermelho" : "neutro"; return <div key={chave} className="flex min-w-0 items-center gap-2">
          <IconeTom tom={tom} tamanho="pequeno">{tom === "verde" ? <Check /> : tom === "vermelho" ? <X /> : <Minus />}</IconeTom>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">{nomesDiagnostico[chave] ?? chave}</dt><dd>{valoresDiagnostico[v] ?? v}</dd></div>
        </div>; })}</dl>}
      </Secao>

      <Secao rotulo="Aplicações" titulo="Aplicações cadastradas" icone={<AppWindow />} tom="roxo" descricao="O nome amigável não comprova a identidade do cliente. Redirecionamentos são comparados exatamente."
        acoes={<><Button variant="outline" disabled={!editar} onClick={abrirCliente}><Plus className="size-4" />Cadastrar aplicação</Button><Button disabled={!editar || !dados.clientes.length} onClick={() => abrirAutorizacao(null)}><Plus className="size-4" />Preparar autorização</Button></>}>
        <ul className="divide-y divide-border/80">{dados.clientes.map(c => <li key={c.id} className="space-y-2 py-3 text-sm first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2"><strong className="break-words">{c.nome}</strong><Badge variant={c.ativo ? "success" : "muted"}>{c.ativo ? "Ativa" : "Inativa"}</Badge></div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Identificador de cliente</span><code className="min-w-0 rounded-[var(--ds-controle-raio)] bg-muted px-2 py-1 text-xs break-all">{c.id}</code><Button size="sm" variant="outline" aria-label={`Copiar identificador de ${c.nome}`} onClick={() => copiar(c.id, "Identificador copiado.")}><Copy className="size-4" />Copiar</Button></div>
          <p className="break-all text-xs text-muted-foreground">{c.redirectUris.join(", ")}</p>
        </li>)}</ul>
        {!dados.clientes.length && <p className="text-sm text-muted-foreground">Nenhuma aplicação cadastrada.</p>}
        {verUsuarios && <Button variant="link" render={<Link href="/configuracoes/usuarios" />}><Users className="size-4" />Administrar Usuários e permissões</Button>}
      </Secao>

      <Secao rotulo="Histórico" titulo="Histórico de uso" icone={<Activity />} tom="azul" descricao={`Retenção técnica: ${LIMITES_MCP.retencaoDias} dias, com limpeza em lotes durante uso e diagnóstico. Sem credenciais, argumentos ou respostas financeiras nos logs.`}>
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} aoAlterar={setPeriodo} />
        <div className="flex flex-wrap items-end gap-3"><Campo titulo="Função"><SelecaoFormulario value={ferramenta} onValueChange={setFerramenta}><option value="">Todas</option>{FUNCOES_MCP.map(f => <option key={f.nome} value={f.nome}>{f.titulo}</option>)}</SelecaoFormulario></Campo><Campo titulo="Resultado"><SelecaoFormulario value={resultado} onValueChange={setResultado}><option value="">Todos</option><option value="OK">Concluído</option><option value="NEGADO">Negado</option><option value="invalid_token">Credencial inválida</option><option value="insufficient_scope">Sem permissão</option><option value="ERRO">Erro</option></SelecaoFormulario></Campo><Button variant="outline" render={<Link href={filtro(1)} />}>Aplicar filtros</Button></div>
        <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Responsável / aplicação</TableHead><TableHead>Evento / função</TableHead><TableHead>Resultado</TableHead><TableHead>Duração</TableHead><TableHead>Correlação</TableHead></TableRow></TableHeader><TableBody>{dados.eventos.map(e => { const r = RESULTADOS[e.resultado] ?? { rotulo: e.resultado, variante: "muted" as const }; return <TableRow key={e.id}><TableCell className="text-xs">{dataHora(e.createdAt)}</TableCell><TableCell>{dados.usuarios.find(u => u.id === e.usuarioId)?.nome ?? e.usuarioId ?? "Não autenticado"}<div className="text-xs text-muted-foreground">{dados.clientes.find(c => c.id === e.clienteId)?.nome ?? e.clienteId ?? "HUB"}</div></TableCell><TableCell className="text-xs">{e.acao}<div>{e.ferramenta}</div></TableCell><TableCell><Badge variant={r.variante}>{r.rotulo}</Badge></TableCell><TableCell>{e.duracaoMs} ms</TableCell><TableCell className="text-xs">{e.correlacao}</TableCell></TableRow>; })}</TableBody></Table>
        {!dados.eventos.length && <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>}
        <GrupoAcoes className="flex-wrap"><span className="text-sm text-muted-foreground">Página {dados.pagina} · {dados.totalEventos} eventos</span><Button variant="outline" disabled={dados.pagina <= 1} render={<Link href={filtro(Math.max(1, dados.pagina - 1))} />}>Anterior</Button><Button variant="outline" disabled={dados.pagina * 50 >= dados.totalEventos} render={<Link href={filtro(dados.pagina + 1)} />}>Próxima</Button></GrupoAcoes>
      </Secao>

      <Funcionalidades autorizacao={null} />
    </>;
  }

  return <div className="space-y-5">
    {erro && !modal && !confirmacao && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {conexao ? detalheDaConexao(conexao) : selecao === "nova" ? novaConexao() : servidor()}

    <Dialog open={modal !== null} onOpenChange={aberto => { if (!aberto && !pendente) setModal(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{modal === "cliente" ? "Cadastrar aplicação" : "Conexão individual"}</DialogTitle><DialogDescription>{modal === "cliente" ? "Copie o redirecionamento exato da configuração OAuth do cliente: um endereço HTTPS ou, para aplicativo instalado no computador, http://127.0.0.1 com a porta. Nenhuma conexão é autorizada neste cadastro." : "Salvar invalida as credenciais atuais e exige novo consentimento do responsável. Nenhuma permissão do HUB é alterada."}</DialogDescription></DialogHeader>
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
