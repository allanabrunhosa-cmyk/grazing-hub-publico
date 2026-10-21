"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { definirContextoAtividade } from "@/lib/atividades/registro";
import { registrarAutenticacao } from "@/lib/atividades/autenticacao";
import { contextoExecucao } from "@/lib/contexto-execucao";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { randomBytes } from "node:crypto";
import { emailConfigurado } from "@/lib/recuperacao-senha/email";
import { criarLinkRecuperacao, enviarLinkRecuperacao, type LinkRecuperacao } from "@/lib/recuperacao-senha/servico";
import type { Prisma } from "@/generated/prisma/client";
import { ErroValidacaoPermissoes, ACOES, SECOES, validarPermissoes, validarExcecoes, permissaoEfetiva, todasPermissoes, type Permissoes, type Excecoes, type Acao } from "@/lib/permissoes/catalogo";
import type { DadosAcessos } from "./types";

class ErroGestaoAcessos extends Error {}
class ErroAutorizacaoGestaoAcessos extends ErroGestaoAcessos {}
type Ator = { id: string; admin: boolean; permissoes: Permissoes; excecoes: Excecoes };
type Resultado = { ok: true; aviso?: string } | { erro: string };
function comoJson(valor: unknown) { return valor as Prisma.InputJsonValue; }
function exigirAlcance(ator: Ator, permissoes: Permissoes, excecoes: Excecoes = {}) {
  if (ator.admin) return;
  for (const secao of SECOES) for (const acao of ACOES) {
    if (permissaoEfetiva(permissoes, excecoes, secao.id, acao) && !permissaoEfetiva(ator.permissoes, ator.excecoes, secao.id, acao)) throw new ErroAutorizacaoGestaoAcessos("Você só pode conceder ou alterar acessos que também possui.");
  }
}
async function alterar(acao: Acao, operacao: (tx: Prisma.TransactionClient, ator: Ator) => Promise<void>): Promise<Resultado> {
  const sessao = await getSession();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
      if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroGestaoAcessos("Sua sessão foi encerrada.");
      const ator: Ator = { id: usuario.id, admin: usuario.perfilAcesso?.sistema === "ADMINISTRADOR", permissoes: (usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, excecoes: usuario.permissoesPersonalizadas as Excecoes };
      if (!ator.admin && !permissaoEfetiva(ator.permissoes, ator.excecoes, "configuracoes.usuarios", acao)) throw new ErroAutorizacaoGestaoAcessos("Seu acesso não permite esta ação.");
      await definirContextoAtividade(tx, contextoExecucao() ? "MCP" : "INTERFACE");
      await operacao(tx, ator);
    }, { timeout: 20_000 });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroAutorizacaoGestaoAcessos) await registrarAutenticacao(sessao, "AUTORIZACAO_NEGADA");
    if (typeof erro === "object" && erro && "code" in erro && erro.code === "P2002") return { erro: "Já existe um cadastro com este nome ou e-mail." };
    return { erro: (erro instanceof ErroGestaoAcessos || erro instanceof ErroValidacaoPermissoes) ? erro.message : "Não foi possível salvar. Tente novamente." };
  }
}
function conferirVersao(data: Date, versao?: string) { if (data.toISOString() !== versao) throw new ErroGestaoAcessos("Este cadastro foi alterado por outra pessoa. Atualize a página e confira antes de salvar."); }
async function historico(tx: Prisma.TransactionClient, ator: Ator, entidade: string, entidadeId: string, acao: string, antes: unknown, depois: unknown) {
  await tx.historicoAcesso.create({ data: { autorId: ator.id, entidade, entidadeId, acao, ...(antes ? { antes: comoJson(antes) } : {}), ...(depois ? { depois: comoJson(depois) } : {}) } });
}
export async function salvarPerfilAcesso(input: { id?: string; nome: string; descricao: string; permissoes: Permissoes; versao?: string }): Promise<Resultado> {
  return alterar(input.id ? "editar" : "adicionar", async (tx, ator) => {
    const nome = input.nome?.trim();
    if (!nome || nome.length > 80 || input.descricao.length > 300) throw new ErroGestaoAcessos("Informe um nome de até 80 caracteres e descrição de até 300.");
    const permissoes = validarPermissoes(input.permissoes);
    exigirAlcance(ator, permissoes);
    const anterior = input.id ? await tx.perfilAcesso.findUniqueOrThrow({ where: { id: input.id } }) : null;
    if (anterior) {
      conferirVersao(anterior.updatedAt, input.versao);
      if (anterior.sistema === "ADMINISTRADOR") throw new ErroGestaoAcessos("O perfil Administrador é protegido. Duplique para criar outro perfil.");
      exigirAlcance(ator, anterior.permissoes as Permissoes);
      if (!ator.admin) {
        const vinculados = await tx.usuario.findMany({ where: { perfilAcessoId: anterior.id, excluidoEm: null }, select: { permissoesPersonalizadas: true } });
        for (const vinculado of vinculados) {
          exigirAlcance(ator, anterior.permissoes as Permissoes, vinculado.permissoesPersonalizadas as Excecoes);
          exigirAlcance(ator, permissoes, vinculado.permissoesPersonalizadas as Excecoes);
        }
      }
    }
    const dados = { nome, descricao: input.descricao.trim() || null, permissoes: comoJson(permissoes) };
    const perfil = anterior ? await tx.perfilAcesso.update({ where: { id: anterior.id }, data: dados }) : await tx.perfilAcesso.create({ data: dados });
    await historico(tx, ator, "Perfil", perfil.id, anterior ? "Perfil atualizado" : "Perfil criado", anterior ? { nome: anterior.nome, permissoes: anterior.permissoes } : null, dados);
  });
}
export async function excluirPerfilAcesso(id: string, versao: string): Promise<Resultado> {
  return alterar("excluir", async (tx, ator) => {
    const perfil = await tx.perfilAcesso.findUniqueOrThrow({ where: { id }, include: { _count: { select: { usuarios: true } } } });
    conferirVersao(perfil.updatedAt, versao);
    if (perfil.sistema === "ADMINISTRADOR") throw new ErroGestaoAcessos("O perfil Administrador é protegido.");
    if (perfil._count.usuarios) throw new ErroGestaoAcessos("Este perfil tem usuários vinculados. Transfira-os para outro perfil antes de excluir.");
    exigirAlcance(ator, perfil.permissoes as Permissoes);
    await tx.perfilAcesso.delete({ where: { id } });
    await historico(tx, ator, "Perfil", id, "Perfil excluído", { nome: perfil.nome, permissoes: perfil.permissoes }, null);
  });
}
function dadosPublicos(usuario: { nome: string; email: string; ativo: boolean; perfilAcessoId: string | null; permissoesPersonalizadas: unknown }) {
  return { nome: usuario.nome, email: usuario.email, ativo: usuario.ativo, perfilAcessoId: usuario.perfilAcessoId, excecoes: usuario.permissoesPersonalizadas };
}
export async function salvarUsuarioAcesso(input: { id?: string; nome: string; email: string; ativo: boolean; perfilAcessoId: string; excecoes: Excecoes; versao?: string }): Promise<Resultado> {
  let link: LinkRecuperacao | undefined;
  const resultado = await alterar(input.id ? "editar" : "adicionar", async (tx, ator) => {
    const nome = input.nome?.trim(), email = input.email?.trim().toLowerCase();
    if (!nome || nome.length > 120 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof input.ativo !== "boolean") throw new ErroGestaoAcessos("Preencha nome, e-mail válido e situação do usuário.");
    const perfil = await tx.perfilAcesso.findUniqueOrThrow({ where: { id: input.perfilAcessoId } });
    const administrador = perfil.sistema === "ADMINISTRADOR";
    if (administrador && !ator.admin) throw new ErroGestaoAcessos("Somente administradores podem atribuir este perfil.");
    const base = administrador ? todasPermissoes() : perfil.permissoes as Permissoes;
    const excecoes = validarExcecoes(input.excecoes, base);
    if (administrador && Object.keys(excecoes).length) throw new ErroGestaoAcessos("O perfil Administrador não admite exceções.");
    exigirAlcance(ator, base, excecoes);
    const anterior = input.id ? await tx.usuario.findUniqueOrThrow({ where: { id: input.id }, include: { perfilAcesso: true } }) : null;
    if (anterior) {
      conferirVersao(anterior.updatedAt, input.versao);
      if (anterior.excluidoEm) throw new ErroGestaoAcessos("Este usuário foi excluído.");
      if ((anterior.perfilAcesso?.sistema === "ADMINISTRADOR") && !ator.admin) throw new ErroGestaoAcessos("Somente administradores podem alterar este usuário.");
      exigirAlcance(ator, anterior.perfilAcesso?.sistema === "ADMINISTRADOR" ? todasPermissoes() : (anterior.perfilAcesso?.permissoes ?? {}) as Permissoes, anterior.permissoesPersonalizadas as Excecoes);
      if ((anterior.perfilAcesso?.sistema === "ADMINISTRADOR") && anterior.ativo && (!administrador || !input.ativo)) {
        const outros = await tx.usuario.count({ where: { id: { not: anterior.id }, ativo: true, senhaDefinida: true, excluidoEm: null, perfilAcesso: { sistema: "ADMINISTRADOR" } } });
        if (!outros) throw new ErroGestaoAcessos("Mantenha pelo menos um administrador ativo no sistema.");
      }
    }
    if (!anterior && input.ativo && !await emailConfigurado()) throw new ErroGestaoAcessos("Configure o envio de e-mail antes de convidar um usuário.");
    const dados = { nome, email, ativo: input.ativo, perfilAcessoId: perfil.id, admin: administrador, permissoesPersonalizadas: comoJson(excecoes) };
    const usuario = anterior ? await tx.usuario.update({ where: { id: anterior.id }, data: { ...dados, ...(!input.ativo ? { sessaoVersao: { increment: 1 } } : {}), ...(email !== anterior.email ? { emailVerificadoEm: null } : {}) } }) : await tx.usuario.create({ data: { ...dados, senhaHash: await hashPassword(randomBytes(48).toString("base64url")), senhaDefinida: false, responsavelEtiquetaHabilitado: false } });
    if (!anterior && usuario.ativo) link = await criarLinkRecuperacao(tx, usuario);
    await historico(tx, ator, "Usuário", usuario.id, anterior ? "Usuário atualizado" : "Usuário criado com convite pendente", anterior ? dadosPublicos(anterior) : null, dadosPublicos(usuario));
  });
  if ("erro" in resultado || !link) return resultado;
  try { await enviarLinkRecuperacao(link); return resultado; }
  catch { return { ok: true, aviso: "Usuário criado. O convite não foi enviado. Abra o cadastro e use Enviar link de senha para tentar novamente." }; }
}

export async function enviarLinkSenhaUsuarioAcesso(id: string, versao: string): Promise<Resultado> {
  let link: LinkRecuperacao | undefined;
  const resultado = await alterar("editar", async (tx, ator) => {
    if (typeof id !== "string" || !id || id.length > 100 || typeof versao !== "string" || versao.length > 30) throw new ErroGestaoAcessos("Cadastro ou versão inválidos. Atualize a página.");
    const usuario = await tx.usuario.findUniqueOrThrow({ where: { id }, include: { perfilAcesso: true } });
    conferirVersao(usuario.updatedAt, versao);
    if (!usuario.ativo || usuario.excluidoEm) throw new ErroGestaoAcessos("Ative o usuário antes de enviar o link de senha.");
    if (usuario.perfilAcesso?.sistema === "ADMINISTRADOR" && !ator.admin) throw new ErroGestaoAcessos("Somente administradores podem alterar este usuário.");
    exigirAlcance(ator, usuario.perfilAcesso?.sistema === "ADMINISTRADOR" ? todasPermissoes() : (usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, usuario.permissoesPersonalizadas as Excecoes);
    if (!await emailConfigurado()) throw new ErroGestaoAcessos("Configure o envio de e-mail antes de enviar o link de senha.");
    link = await criarLinkRecuperacao(tx, usuario);
    await historico(tx, ator, "Usuário", usuario.id, "Link de senha solicitado pelo gestor", null, null);
  });
  if ("erro" in resultado || !link) return resultado;
  try { await enviarLinkRecuperacao(link); return resultado; }
  catch { return { erro: "O link não foi enviado. Verifique o serviço de e-mail e tente novamente." }; }
}
export async function excluirUsuarioAcesso(id: string, versao: string): Promise<Resultado> {
  return alterar("excluir", async (tx, ator) => {
    const usuario = await tx.usuario.findUniqueOrThrow({ where: { id }, include: { perfilAcesso: true } });
    conferirVersao(usuario.updatedAt, versao);
    if ((usuario.perfilAcesso?.sistema === "ADMINISTRADOR") && !ator.admin) throw new ErroGestaoAcessos("Somente administradores podem excluir este usuário.");
    exigirAlcance(ator, usuario.perfilAcesso?.sistema === "ADMINISTRADOR" ? todasPermissoes() : (usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, usuario.permissoesPersonalizadas as Excecoes);
    if ((usuario.perfilAcesso?.sistema === "ADMINISTRADOR") && usuario.ativo && !await tx.usuario.count({ where: { id: { not: id }, ativo: true, senhaDefinida: true, excluidoEm: null, perfilAcesso: { sistema: "ADMINISTRADOR" } } })) throw new ErroGestaoAcessos("Mantenha pelo menos um administrador ativo no sistema.");
    await tx.usuario.update({ where: { id }, data: { ativo: false, admin: false, perfilAcessoId: null, permissoesPersonalizadas: {}, excluidoEm: new Date(), sessaoVersao: { increment: 1 } } });
    await historico(tx, ator, "Usuário", id, "Usuário excluído", dadosPublicos(usuario), null);
  });
}
/** Mesmas fronteiras de gestão de acesso; altera só situação e revoga sessões ao inativar. */
export async function alterarStatusUsuarioAcesso(id: string, versao: string, ativo: boolean): Promise<Resultado> {
  return alterar("editar", async (tx, ator) => {
    if (typeof id !== "string" || !id || id.length > 100 || typeof versao !== "string" || typeof ativo !== "boolean") throw new ErroGestaoAcessos("Situação do usuário inválida.");
    const anterior = await tx.usuario.findUniqueOrThrow({ where: { id }, include: { perfilAcesso: true } });
    conferirVersao(anterior.updatedAt, versao);
    if (anterior.excluidoEm) throw new ErroGestaoAcessos("Este usuário foi excluído.");
    const administrador = anterior.perfilAcesso?.sistema === "ADMINISTRADOR";
    if (administrador && !ator.admin) throw new ErroGestaoAcessos("Somente administradores podem alterar este usuário.");
    exigirAlcance(ator, administrador ? todasPermissoes() : (anterior.perfilAcesso?.permissoes ?? {}) as Permissoes, anterior.permissoesPersonalizadas as Excecoes);
    if (administrador && anterior.ativo && !ativo && !await tx.usuario.count({ where: { id: { not: id }, ativo: true, senhaDefinida: true, excluidoEm: null, perfilAcesso: { sistema: "ADMINISTRADOR" } } })) throw new ErroGestaoAcessos("Mantenha pelo menos um administrador ativo no sistema.");
    const depois = await tx.usuario.update({ where: { id }, data: { ativo, ...(!ativo ? { sessaoVersao: { increment: 1 } } : {}) } });
    await historico(tx, ator, "Usuário", id, ativo ? "Usuário ativado" : "Usuário inativado", dadosPublicos(anterior), dadosPublicos(depois));
  });
}
export async function carregarAcessos(): Promise<DadosAcessos | { erro: string }> {
  const sessao = await getSession();
  if (!sessao || (!sessao.admin && !permissaoEfetiva(sessao.permissoes, sessao.excecoes, "configuracoes.usuarios", "visualizar"))) return { erro: "Seu acesso não permite consultar usuários e perfis." };
  const [perfis, usuarios] = await Promise.all([
    prisma.perfilAcesso.findMany({ orderBy: { nome: "asc" }, include: { _count: { select: { usuarios: true } } } }),
    prisma.usuario.findMany({ where: { excluidoEm: null }, orderBy: { nome: "asc" }, select: { id: true, nome: true, email: true, ativo: true, perfilAcessoId: true, permissoesPersonalizadas: true, updatedAt: true } }),
  ]);
  return { perfis: perfis.map(p => ({ id: p.id, nome: p.nome, descricao: p.descricao, sistema: p.sistema, permissoes: p.sistema === "ADMINISTRADOR" ? todasPermissoes() : p.permissoes as Permissoes, usuarios: p._count.usuarios, versao: p.updatedAt.toISOString() })),
    usuarios: usuarios.map(u => ({ id: u.id, nome: u.nome, email: u.email, ativo: u.ativo, perfilAcessoId: u.perfilAcessoId, excecoes: u.permissoesPersonalizadas as Excecoes, versao: u.updatedAt.toISOString() })),
    historico: [] };
}
export async function carregarHistoricoAcessos(): Promise<DadosAcessos["historico"] | { erro: string }> {
  const sessao = await getSession();
  if (!sessao || (!sessao.admin && (!permissaoEfetiva(sessao.permissoes, sessao.excecoes, "configuracoes.usuarios", "visualizar") || !permissaoEfetiva(sessao.permissoes, sessao.excecoes, "configuracoes.usuarios.atividades", "visualizar")))) return { erro: "Seu acesso não permite consultar atividades." };
  try {
    const registros = await prisma.historicoAcesso.findMany({ where: { entidade: { in: ["Usuário", "Perfil"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20,
      select: { id: true, autorId: true, entidade: true, acao: true, createdAt: true } });
    const autores = await prisma.usuario.findMany({ where: { id: { in: [...new Set(registros.map(r => r.autorId))] } }, select: { id: true, nome: true } });
    const nomes = new Map(autores.map(a => [a.id, a.nome]));
    return registros.map(r => ({ id: r.id, autor: nomes.get(r.autorId) ?? "Usuário histórico", entidade: r.entidade, nome: r.entidade, acao: r.acao, data: r.createdAt.toISOString() }));
  } catch { return { erro: "Não foi possível consultar o histórico. Tente novamente." }; }
}
export async function carregarUsuariosExcluidos(busca = ""): Promise<{ id: string; nome: string }[] | { erro: string }> {
  const sessao = await getSession();
  if (!sessao || (!sessao.admin && (!permissaoEfetiva(sessao.permissoes, sessao.excecoes, "configuracoes.usuarios", "visualizar") || !permissaoEfetiva(sessao.permissoes, sessao.excecoes, "configuracoes.usuarios.atividades", "visualizar")))) return { erro: "Seu acesso não permite consultar atividades." };
  if (typeof busca !== "string" || busca.length > 120 || /[\u0000-\u001f]/.test(busca)) return { erro: "Busca inválida." };
  try {
    return await prisma.usuario.findMany({ where: { excluidoEm: { not: null }, ...(busca.trim() ? { nome: { contains: busca.trim(), mode: "insensitive" } } : {}) },
      orderBy: [{ nome: "asc" }, { id: "asc" }], take: 100, select: { id: true, nome: true } });
  } catch { return { erro: "Não foi possível consultar usuários excluídos. Tente novamente." }; }
}
