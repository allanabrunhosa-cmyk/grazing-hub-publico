import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "@/lib/session-token";
import type { Permissoes, Excecoes } from "@/lib/permissoes/catalogo";
import { contextoExecucao } from "@/lib/contexto-execucao";

export type SessaoAtual = SessionPayload & { permissoes: Permissoes; excecoes: Excecoes; perfilNome: string };
// Cache somente durante a renderização: alterações de acesso valem na próxima requisição.
const sessaoDoNavegador = cache(async (): Promise<SessaoAtual | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const sessao = await verifySessionToken(token);
  if (!sessao) return null;
  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.userId }, select: {
    id: true, nome: true, email: true, ativo: true, excluidoEm: true, sessaoVersao: true, senhaDefinida: true,
    permissoesPersonalizadas: true, perfilAcesso: { select: { nome: true, sistema: true, permissoes: true } },
  } });
  if (!usuario?.ativo || !usuario.senhaDefinida || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) return null;
  return { userId: usuario.id, nome: usuario.nome, email: usuario.email,
    admin: usuario.perfilAcesso?.sistema === "ADMINISTRADOR", versao: usuario.sessaoVersao,
    perfilNome: usuario.perfilAcesso?.nome ?? "Sem perfil",
    permissoes: (usuario.perfilAcesso?.permissoes ?? {}) as Permissoes,
    excecoes: usuario.permissoesPersonalizadas as Excecoes,
  };
});

// Identidade do contexto vem do Bearer validado, nunca de um argumento da IA.
// Relê a autorização central também dentro da transação de negócio.
export async function getSession(): Promise<SessaoAtual | null> {
  const contexto = contextoExecucao();
  if (!contexto) return sessaoDoNavegador();
  const usuario = await prisma.usuario.findUnique({ where: { id: contexto.usuarioId }, select: {
    id: true, nome: true, email: true, ativo: true, excluidoEm: true, sessaoVersao: true, senhaDefinida: true,
    permissoesPersonalizadas: true, perfilAcesso: { select: { nome: true, sistema: true, permissoes: true } },
  } });
  if (!usuario?.ativo || !usuario.senhaDefinida || usuario.excluidoEm || usuario.sessaoVersao !== contexto.sessaoVersao) return null;
  return { userId: usuario.id, nome: usuario.nome, email: usuario.email,
    admin: usuario.perfilAcesso?.sistema === "ADMINISTRADOR", versao: usuario.sessaoVersao,
    perfilNome: usuario.perfilAcesso?.nome ?? "Sem perfil",
    permissoes: (usuario.perfilAcesso?.permissoes ?? {}) as Permissoes,
    excecoes: usuario.permissoesPersonalizadas as Excecoes };
}
