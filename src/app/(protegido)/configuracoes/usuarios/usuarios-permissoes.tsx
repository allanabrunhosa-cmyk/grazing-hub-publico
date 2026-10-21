"use client";
import { SelecaoFormulario } from "@/components/ui/select";
import { useRef, useState, useTransition } from "react";
import { ShieldCheck, Users, UserPlus, Plus, SlidersHorizontal, Copy, LockKeyhole, RotateCcw, Save, ChevronRight, Check, History, Loader2, Mail } from "lucide-react";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusAtivo } from "@/components/status-ativo";
import { CampoBusca } from "@/components/campo-busca";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ACOES, type Excecoes, type Acao } from "@/lib/permissoes/catalogo";
import { carregarAcessos, carregarHistoricoAcessos, carregarUsuariosExcluidos, alterarStatusUsuarioAcesso, salvarPerfilAcesso, excluirPerfilAcesso, salvarUsuarioAcesso, excluirUsuarioAcesso, enviarLinkSenhaUsuarioAcesso } from "./actions";
import { MatrizPermissoes } from "./matriz-permissoes";
import { AtividadesUsuario } from "./atividades-usuario";
import type { DadosAcessos, PerfilRow, UsuarioRow } from "./types";

const badge = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium";
const numeroExcecoes = (excecoes: Excecoes) => Object.values(excecoes).reduce((n, valores) => n + Object.keys(valores).length, 0);
const vazioPerfil = (): PerfilRow => ({ id: "", nome: "", descricao: "", sistema: null, permissoes: {}, usuarios: 0, versao: "" });
const vazioUsuario = (): UsuarioRow => ({ id: "", nome: "", email: "", ativo: true, perfilAcessoId: "", excecoes: {}, versao: "" });

export { MatrizPermissoes } from "./matriz-permissoes";

export function UsuariosPermissoes({ inicial, capacidades = ACOES, podeVerAtividades = false }: { inicial: DadosAcessos; capacidades?: readonly Acao[]; podeVerAtividades?: boolean }) {
  const [dados, setDados] = useState(inicial);
  const [aba, setAba] = useState<"usuarios" | "perfis">("usuarios");
  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState<PerfilRow | null>(null);
  const [usuario, setUsuario] = useState<UsuarioRow | null>(null);
  const [abaUsuario, setAbaUsuario] = useState("cadastro");
  const [confirmacao, setConfirmacao] = useState<{ tipo: "perfil" | "usuario"; id: string; nome: string; versao: string } | null>(null);
  const [status, setStatus] = useState<{ usuario: UsuarioRow; ativo: boolean } | null>(null);
  const [erroStatus, setErroStatus] = useState("");
  const travaStatus = useRef(false);
  const [verHistorico, setVerHistorico] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState("");
  const [verExcluidos, setVerExcluidos] = useState(false);
  const [buscaExcluidos, setBuscaExcluidos] = useState("");
  const [excluidos, setExcluidos] = useState<{ id: string; nome: string }[]>([]);
  const [carregandoExcluidos, setCarregandoExcluidos] = useState(false);
  const [erroExcluidos, setErroExcluidos] = useState("");
  const [excluidoSelecionado, setExcluidoSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const pode = (acao: Acao) => capacidades.includes(acao);
  const perfilUsuario = dados.perfis.find(p => p.id === usuario?.perfilAcessoId);
  const usuarioSalvo = dados.usuarios.find(u => u.id === usuario?.id);
  const usuarioAlterado = Boolean(usuario && ((usuarioSalvo
    ? usuario.nome !== usuarioSalvo.nome || usuario.email !== usuarioSalvo.email || usuario.ativo !== usuarioSalvo.ativo || usuario.perfilAcessoId !== usuarioSalvo.perfilAcessoId || JSON.stringify(usuario.excecoes) !== JSON.stringify(usuarioSalvo.excecoes)
    : usuario.nome || usuario.email || usuario.perfilAcessoId || Object.keys(usuario.excecoes).length)));
  function selecionarUsuario(valor: UsuarioRow) { setAbaUsuario("cadastro"); setUsuario(valor); }
  async function abrirHistorico() {
    setVerHistorico(true); setCarregandoHistorico(true); setErroHistorico("");
    try {
      const historico = await carregarHistoricoAcessos();
      if ("erro" in historico) { setErroHistorico(historico.erro); return; }
      setDados(atual => ({ ...atual, historico }));
    } catch { setErroHistorico("Não foi possível consultar as alterações de acesso. Tente novamente."); }
    finally { setCarregandoHistorico(false); }
  }
  async function buscarExcluidos(busca = buscaExcluidos) {
    setVerExcluidos(true); setCarregandoExcluidos(true); setErroExcluidos("");
    try {
      const usuarios = await carregarUsuariosExcluidos(busca);
      if ("erro" in usuarios) { setExcluidos([]); setErroExcluidos(usuarios.erro); return; }
      setExcluidos(usuarios);
    } catch { setExcluidos([]); setErroExcluidos("Não foi possível consultar os usuários excluídos. Tente novamente."); }
    finally { setCarregandoExcluidos(false); }
  }
  const filtro = busca.toLocaleLowerCase("pt-BR");
  function gravar(operacao: () => Promise<{ erro: string } | { ok: true }>, mensagem: string) {
    iniciar(async () => {
      try {
        const resultado = await operacao();
        if ("erro" in resultado) { toast.error(resultado.erro); return; }
        if ("aviso" in resultado && resultado.aviso) toast.warning(String(resultado.aviso)); else toast.success(mensagem);
        setPerfil(null); setUsuario(null); setConfirmacao(null);
        const novos = await carregarAcessos();
        if ("erro" in novos) { toast.info("Alteração salva. Seus acessos foram atualizados; entre novamente se necessário."); return; }
        setDados(novos);
      } catch { toast.error("Não foi possível confirmar o salvamento. Atualize a página para conferir."); }
    });
  }
  async function confirmarStatus() {
    if (!status || travaStatus.current) return;
    travaStatus.current = true; setErroStatus("");
    iniciar(async () => {
      try {
        const resultado = await alterarStatusUsuarioAcesso(status.usuario.id, status.usuario.versao, status.ativo);
        if ("erro" in resultado) { setErroStatus(resultado.erro); return; }
        // Só após confirmação do servidor; a recarga mantém a busca e a aba.
        setDados(atual => ({ ...atual, usuarios: atual.usuarios.map(u => u.id === status.usuario.id ? { ...u, ativo: status.ativo } : u) }));
        setStatus(null); toast.success("Situação do usuário confirmada.");
        const novos = await carregarAcessos();
        if ("erro" in novos) { toast.info("Acesso atualizado. Entre novamente se necessário."); return; }
        setDados(novos);
      } catch { setErroStatus("Não foi possível confirmar. Atualize a página para conferir a situação."); }
      finally { travaStatus.current = false; }
    });
  }
  const confirmacaoExclusao = <Dialog open={!!confirmacao} onOpenChange={aberto => { if (!aberto && !pendente) setConfirmacao(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir {confirmacao?.nome}?</DialogTitle><DialogDescription>{confirmacao?.tipo === "usuario" ? "O acesso será encerrado. O histórico das operações realizadas por esta pessoa será preservado." : "Perfis com usuários vinculados precisam ser desvinculados antes da exclusão."}</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={pendente} onClick={() => setConfirmacao(null)}>Cancelar</Button><Button variant="destructive" disabled={pendente} onClick={() => confirmacao && gravar(() => confirmacao.tipo === "perfil" ? excluirPerfilAcesso(confirmacao.id, confirmacao.versao) : excluirUsuarioAcesso(confirmacao.id, confirmacao.versao), "Cadastro excluído.")}>Confirmar exclusão</Button></div></DialogContent></Dialog>;
  return <div className="space-y-6">
    <BarraAcoes titulo="Usuários & Permissões" descricao="As pessoas certas, com o acesso certo a cada parte do HUB.">{podeVerAtividades && <><Button variant="outline" onClick={() => { setBuscaExcluidos(""); void buscarExcluidos(""); }}><Users className="size-4" />Usuários excluídos</Button><Button variant="outline" onClick={() => void abrirHistorico()}><History className="size-4" />Histórico de alterações</Button></>}</BarraAcoes>
    <div className="grid gap-3 sm:grid-cols-3">{[
      { titulo: "Usuários ativos", valor: dados.usuarios.filter(u => u.ativo).length, texto: `${dados.usuarios.length} ${dados.usuarios.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"}`, Icone: Users },
      { titulo: "Perfis de acesso", valor: dados.perfis.length, texto: "Regras compartilhadas pela equipe", Icone: ShieldCheck },
      { titulo: "Acessos personalizados", valor: dados.usuarios.filter(u => numeroExcecoes(u.excecoes)).length, texto: "Usuários com exceções ao perfil", Icone: SlidersHorizontal },
    ].map(({ titulo, valor, texto, Icone }) => <div key={titulo} className="flex items-center gap-4 rounded-2xl border bg-card p-5"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icone className="size-5" /></span><div><p className="text-xs font-medium text-muted-foreground">{titulo}</p><p className="mt-0.5 text-2xl font-semibold tracking-tight">{valor}</p><p className="text-xs text-muted-foreground">{texto}</p></div></div>)}</div>
    <Tabs value={aba} onValueChange={valor => { if (valor === "usuarios" || valor === "perfis") { setAba(valor); setBusca(""); } }} className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b p-4"><TabsList aria-label="Cadastros de acesso">{(["usuarios", "perfis"] as const).map(a => <TabsTrigger key={a} value={a}>{a === "usuarios" ? <Users className="size-4" /> : <ShieldCheck className="size-4" />}{a === "usuarios" ? "Usuários" : "Perfis de acesso"}</TabsTrigger>)}</TabsList><CampoBusca aria-label="Buscar usuários ou perfis" placeholder={aba === "usuarios" ? "Buscar por nome ou e-mail..." : "Buscar perfil..."} value={busca} onChange={setBusca} containerClassName="ml-auto w-full sm:w-64" />{pode("adicionar") && <Button onClick={() => aba === "usuarios" ? selecionarUsuario(vazioUsuario()) : setPerfil(vazioPerfil())}>{aba === "usuarios" ? <UserPlus className="size-4" /> : <Plus className="size-4" />}{aba === "usuarios" ? "Novo usuário" : "Novo perfil"}</Button>}</div>
      <TabsContent value="usuarios" aria-label="Usuários">
        <div className="hidden grid-cols-[minmax(230px,1.5fr)_minmax(160px,1fr)_120px_100px] gap-3 bg-muted/25 px-5 py-3 text-xs font-medium text-muted-foreground lg:grid"><span>USUÁRIO</span><span>PERFIL E PERMISSÕES</span><span>SITUAÇÃO</span><span className="text-right">AÇÕES</span></div>
        {dados.usuarios.filter(u => `${u.nome} ${u.email}`.toLocaleLowerCase("pt-BR").includes(filtro)).map(u => <div key={u.id} className="grid items-center gap-3 border-t px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(230px,1.5fr)_minmax(160px,1fr)_120px_100px]">
          <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{u.nome.split(" ").filter(Boolean).slice(0,2).map(n => n[0]).join("")}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{u.nome}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div></div>
          <div><span className="text-sm">{dados.perfis.find(p => p.id === u.perfilAcessoId)?.nome ?? "Sem perfil"}</span><p className={`mt-1 flex items-center gap-1 text-xs ${numeroExcecoes(u.excecoes) ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{numeroExcecoes(u.excecoes) ? <><SlidersHorizontal className="size-3" />{numeroExcecoes(u.excecoes)} {numeroExcecoes(u.excecoes) === 1 ? "permissão personalizada" : "permissões personalizadas"}</> : <><Check className="size-3" />Segue o perfil</>}</p></div>
          <StatusAtivo ativo={u.ativo} nome={u.nome} disabled={pendente} motivoBloqueio={!pode("editar") ? "Seu perfil permite somente consultar usuários." : undefined} onChange={ativo => { setErroStatus(""); setStatus({ usuario: u, ativo }); }} />
          <GrupoAcoes nome={`Ações de ${u.nome}`} className="justify-self-start lg:justify-self-end">
            <Button variant={pode("editar") ? "editar" : "ghost"} aria-label={pode("editar") ? `Gerenciar ${u.nome}` : `Ver acesso de ${u.nome}`} onClick={() => selecionarUsuario({ ...structuredClone(u) })}>{!pode("editar") && <>Ver acesso<ChevronRight className="size-4" /></>}</Button>
            {pode("excluir") && <Button type="button" variant="excluir" aria-label={`Excluir usuário ${u.nome}`} title={`Excluir usuário ${u.nome}`} disabled={pendente} onClick={() => setConfirmacao({ tipo: "usuario", id: u.id, nome: u.nome, versao: u.versao })} />}
          </GrupoAcoes>
        </div>)}
        {!dados.usuarios.some(u => `${u.nome} ${u.email}`.toLocaleLowerCase("pt-BR").includes(filtro)) && <p className="p-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado. Ajuste a busca ou cadastre uma pessoa.</p>}
      </TabsContent><TabsContent value="perfis" aria-label="Perfis de acesso" className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{dados.perfis.filter(p => p.nome.toLowerCase().includes(filtro)).map(p => <div key={p.id} className="flex flex-col rounded-2xl border bg-background/60 p-5"><div className="mb-4 flex items-center justify-between"><ShieldCheck className="size-6 text-primary" />{p.sistema === "ADMINISTRADOR" && <span className={`${badge} bg-muted text-muted-foreground`}><LockKeyhole className="size-3" />Protegido</span>}</div><h2 className="font-semibold">{p.nome}</h2><p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.descricao || "Perfil personalizado para sua equipe."}</p><p className="mt-4 text-xs text-muted-foreground">{p.usuarios} {p.usuarios === 1 ? "usuário vinculado" : "usuários vinculados"}</p><div className="mt-4 flex gap-2 border-t pt-4"><Button variant="outline" className="flex-1" onClick={() => setPerfil(structuredClone(p))}>Ver permissões</Button>{pode("adicionar") && <Button variant="ghost" aria-label={`Duplicar perfil ${p.nome}`} onClick={() => setPerfil({ ...structuredClone(p), id: "", nome: `${p.nome} — cópia`, sistema: null, usuarios: 0, versao: "" })}><Copy className="size-4" /></Button>}</div></div>)}{!dados.perfis.some(p => p.nome.toLowerCase().includes(filtro)) && <p className="p-8 text-sm text-muted-foreground">Nenhum perfil encontrado.</p>}</TabsContent>
    </Tabs>
    {confirmacao?.tipo === "usuario" && !usuario && confirmacaoExclusao}
    <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-muted-foreground"><strong className="font-medium text-foreground">Comece pelo perfil.</strong> Defina as regras da função, vincule as pessoas e personalize apenas as exceções. Alterações no perfil valem para todos os usuários vinculados.</p></div>

    <Dialog open={!!perfil} onOpenChange={aberto => { if (!aberto && !pendente) setPerfil(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{perfil?.id ? perfil.nome : "Novo perfil de acesso"}</DialogTitle><DialogDescription>Defina o que as pessoas com este perfil podem fazer.</DialogDescription></DialogHeader>{perfil && <form onSubmit={e => { e.preventDefault(); gravar(() => salvarPerfilAcesso({ ...perfil, id: perfil.id || undefined, descricao: perfil.descricao ?? "" }), "Perfil salvo. Os acessos da equipe foram atualizados."); }} className="space-y-5">
      <fieldset disabled={pendente || perfil.sistema === "ADMINISTRADOR" || !pode(perfil.id ? "editar" : "adicionar")} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">Nome do perfil<Input required maxLength={80} placeholder="Ex.: Compras, Financeiro, Operação" value={perfil.nome} onChange={e => setPerfil({ ...perfil, nome: e.target.value })} /></label><label className="space-y-1.5 text-sm font-medium">Descrição<Input maxLength={300} placeholder="Para quem é este perfil?" value={perfil.descricao ?? ""} onChange={e => setPerfil({ ...perfil, descricao: e.target.value })} /></label></div></fieldset>
      {perfil.sistema === "ADMINISTRADOR" && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">O Administrador possui acesso completo. Duplique este perfil para criar uma versão personalizada.</p>}
      <MatrizPermissoes base={perfil.permissoes} bloqueada={pendente || perfil.sistema === "ADMINISTRADOR" || !pode(perfil.id ? "editar" : "adicionar")} aoMudar={permissoes => setPerfil({ ...perfil, permissoes })} />
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background py-3">{perfil.id && perfil.sistema !== "ADMINISTRADOR" && pode("excluir") && <Button type="button" variant="excluir" aria-label="Excluir perfil" title="Excluir perfil" disabled={pendente} onClick={() => setConfirmacao({ tipo: "perfil", id: perfil.id, nome: perfil.nome, versao: perfil.versao })} />}<DialogClose render={<Button type="button" variant="outline" className="ml-auto" disabled={pendente} />}>Fechar</DialogClose>{perfil.sistema !== "ADMINISTRADOR" && pode(perfil.id ? "editar" : "adicionar") && <Button type="submit" disabled={pendente}><Save className="size-4" />{pendente ? "Salvando..." : "Salvar perfil"}</Button>}</div>
    </form>}{confirmacao?.tipo === "perfil" && confirmacaoExclusao}</DialogContent></Dialog>

    <Dialog open={!!usuario} alterado={usuarioAlterado} onOpenChange={aberto => { if (!aberto && !pendente) setUsuario(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{usuario?.id ? "Gerenciar usuário" : "Novo usuário"}</DialogTitle><DialogDescription>Vincule um perfil e ajuste os acessos individuais quando necessário.</DialogDescription></DialogHeader>{usuario && <Tabs value={abaUsuario} onValueChange={setAbaUsuario} className="min-w-0">{usuario.id && <TabsList aria-label="Informações do usuário"><TabsTrigger type="button" value="cadastro">Cadastro</TabsTrigger><TabsTrigger type="button" value="atividades"><History className="size-4" />Atividades</TabsTrigger></TabsList>}<TabsContent value="cadastro" keepMounted><form className="space-y-5" onSubmit={e => { e.preventDefault(); gravar(() => salvarUsuarioAcesso({ ...usuario, id: usuario.id || undefined, perfilAcessoId: usuario.perfilAcessoId ?? "" }), usuario.id ? "Usuário salvo com sucesso." : usuario.ativo ? "Usuário criado. Convite aceito pelo serviço de e-mail." : "Usuário criado inativo. Ative e envie o link de senha."); }}>
      <fieldset disabled={pendente || !pode(usuario.id ? "editar" : "adicionar")} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">Nome completo<Input required maxLength={120} value={usuario.nome} onChange={e => setUsuario({ ...usuario, nome: e.target.value })} /></label><label className="space-y-1.5 text-sm font-medium">E-mail de acesso<Input required type="email" maxLength={254} autoComplete="off" value={usuario.email} onChange={e => setUsuario({ ...usuario, email: e.target.value })} /></label><label className="space-y-1.5 text-sm font-medium">Perfil de acesso<SelecaoFormulario required value={usuario.perfilAcessoId ?? ""} onValueChange={novoValor => setUsuario({ ...usuario, perfilAcessoId: novoValor, excecoes: {} })}><option value="">Selecione um perfil</option>{dados.perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</SelecaoFormulario></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={usuario.ativo} onChange={e => setUsuario({ ...usuario, ativo: e.target.checked })} />Usuário ativo — acesso liberado após criar a senha</label><p className="text-xs text-muted-foreground">O usuário cria a própria senha pelo link enviado por e-mail. Ao salvar a senha, ele confirma o e-mail. A mesma conta vale nos quatro sistemas, conforme o perfil de acesso.</p></fieldset>
      {perfilUsuario && <><div className="flex flex-wrap items-center gap-2 border-t pt-4"><h3 className="mr-auto font-semibold">Permissões deste usuário</h3>{numeroExcecoes(usuario.excecoes) ? <><span className={`${badge} bg-amber-500/10 text-amber-700 dark:text-amber-400`}>{numeroExcecoes(usuario.excecoes)} {numeroExcecoes(usuario.excecoes) === 1 ? "personalizada" : "personalizadas"}</span>{pode(usuario.id ? "editar" : "adicionar") && <Button type="button" variant="ghost" disabled={pendente} onClick={() => setUsuario({ ...usuario, excecoes: {} })}><RotateCcw className="size-3.5" />Restaurar perfil</Button>}</> : <span className={`${badge} bg-primary/10 text-primary`}><Check className="size-3" />Herdadas de {perfilUsuario.nome}</span>}</div><MatrizPermissoes base={perfilUsuario.permissoes} excecoes={usuario.excecoes} bloqueada={pendente || perfilUsuario.sistema === "ADMINISTRADOR" || !pode(usuario.id ? "editar" : "adicionar")} aoPersonalizar={excecoes => setUsuario({ ...usuario, excecoes })} /></>}
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background py-3">{usuario.id && usuario.ativo && pode("editar") && <Button type="button" variant="outline" disabled={pendente || usuarioAlterado} onClick={() => gravar(() => enviarLinkSenhaUsuarioAcesso(usuario.id, usuario.versao), "Link de senha aceito pelo serviço de e-mail.")}><Mail className="size-4" />Enviar link de senha</Button>}{usuario.id && pode("excluir") && <Button type="button" variant="excluir" aria-label="Excluir usuário" title="Excluir usuário" disabled={pendente} onClick={() => setConfirmacao({ tipo: "usuario", id: usuario.id, nome: usuario.nome, versao: usuario.versao })} />}<DialogClose render={<Button type="button" variant="outline" className="ml-auto" disabled={pendente} />}>Fechar</DialogClose>{pode(usuario.id ? "editar" : "adicionar") && <Button type="submit" disabled={pendente}><Save className="size-4" />{pendente ? "Salvando..." : "Salvar usuário"}</Button>}</div>
    </form></TabsContent>{usuario.id && <TabsContent value="atividades">{abaUsuario === "atividades" && <AtividadesUsuario usuarioId={usuario.id} nomeUsuario={usuario.nome} podeVer={podeVerAtividades} />}<div className="mt-4 flex justify-end border-t pt-3"><DialogClose render={<Button type="button" variant="outline" disabled={pendente} />}>Fechar</DialogClose></div></TabsContent>}</Tabs>}{confirmacao?.tipo === "usuario" && confirmacaoExclusao}</DialogContent></Dialog>
    <Dialog open={!!status} protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto && !travaStatus.current) setStatus(null); }}><DialogContent><DialogHeader><DialogTitle>{status?.ativo ? "Ativar" : "Inativar"} {status?.usuario.nome}?</DialogTitle><DialogDescription>{status?.ativo ? "O usuário poderá entrar com o perfil e as permissões já cadastrados." : "As sessões deste usuário serão encerradas e ele não poderá entrar até ser reativado. O histórico será preservado."}</DialogDescription></DialogHeader>{erroStatus && <p role="alert" className="text-sm text-destructive">{erroStatus}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={pendente} onClick={() => setStatus(null)}>Cancelar</Button><Button disabled={pendente} onClick={confirmarStatus}>{pendente ? "Confirmando…" : "Confirmar situação"}</Button></div></DialogContent></Dialog>
    <Dialog open={verExcluidos} protegerAlteracoes={false} onOpenChange={setVerExcluidos}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Usuários excluídos</DialogTitle><DialogDescription>Consulte atividades preservadas de pessoas cujo acesso foi excluído.</DialogDescription></DialogHeader><form className="flex flex-wrap items-center gap-2" aria-label="Busca de usuários excluídos" onSubmit={e => { e.preventDefault(); if (!carregandoExcluidos) void buscarExcluidos(); }}><CampoBusca aria-label="Buscar usuários excluídos" placeholder="Buscar por nome…" maxLength={120} value={buscaExcluidos} onChange={valor => setBuscaExcluidos(valor.replace(/[\p{Cc}\p{Cf}<>]/gu, "").slice(0, 120))} containerClassName="min-w-0 flex-1" /><Button type="submit" variant="outline" disabled={carregandoExcluidos}>Buscar</Button></form>{carregandoExcluidos ? <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando usuários…</p> : erroExcluidos ? <p role="alert" className="text-sm text-destructive">{erroExcluidos}</p> : excluidos.length ? <div className="space-y-2">{excluidos.map(u => <div key={u.id} className="flex min-w-0 items-center justify-between gap-3 border-b py-3"><p className="min-w-0 break-words text-sm font-medium">{u.nome}</p><Button type="button" variant="outline" size="sm" aria-label={`Atividades de ${u.nome}`} onClick={() => setExcluidoSelecionado(u)}>Atividades</Button></div>)}{excluidos.length === 100 && <p className="text-xs text-muted-foreground">Até 100 usuários por busca. Refine o nome para encontrar outras pessoas.</p>}</div> : <p role="status" className="py-6 text-center text-sm text-muted-foreground">Nenhum usuário excluído encontrado.</p>}<Dialog open={!!excluidoSelecionado} protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto) setExcluidoSelecionado(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{excluidoSelecionado?.nome}</DialogTitle><DialogDescription>Usuário excluído. As evidências de atividade permanecem disponíveis para consulta.</DialogDescription></DialogHeader>{excluidoSelecionado && <Tabs defaultValue="atividades" className="min-w-0"><TabsList aria-label="Informações do usuário excluído"><TabsTrigger value="atividades"><History className="size-4" />Atividades</TabsTrigger></TabsList><TabsContent value="atividades"><AtividadesUsuario usuarioId={excluidoSelecionado.id} nomeUsuario={excluidoSelecionado.nome} podeVer={podeVerAtividades} /></TabsContent></Tabs>}</DialogContent></Dialog></DialogContent></Dialog>
    <Dialog open={verHistorico} protegerAlteracoes={false} onOpenChange={setVerHistorico}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Histórico de alterações</DialogTitle><DialogDescription>Últimas alterações em usuários, perfis e permissões.</DialogDescription></DialogHeader>{carregandoHistorico ? <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando alterações…</p> : erroHistorico ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{erroHistorico}</p><Button type="button" variant="outline" onClick={() => void abrirHistorico()}>Tentar novamente</Button></div> : dados.historico.length ? dados.historico.map(h => <div key={h.id} className="border-b py-3"><p className="text-sm font-medium">{h.acao} · {h.nome}</p><p className="text-xs text-muted-foreground">{h.autor} · {new Date(h.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">As alterações feitas a partir de agora aparecerão aqui.</p>}</DialogContent></Dialog>
  </div>;
}
