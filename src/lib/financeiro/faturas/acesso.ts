import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Acao, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import { ErroFatura } from "./dominio";

export async function autorFatura(tx: Prisma.TransactionClient, sessao: SessaoAtual, recurso: string, acao: Acao) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroFatura("Sua sessão expirou. Entre novamente.");
  const pode = (r: string, a: Acao) => usuario.perfilAcesso?.sistema === "ADMINISTRADOR"
    || permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, (usuario.permissoesPersonalizadas ?? {}) as Excecoes, r, a);
  if (!pode("financeiro.faturas", "visualizar") || !pode(recurso,acao)) throw new ErroFatura("Seu acesso não permite esta operação de cartão.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('financeiro-cartoes'))`;
  return { id: usuario.id, nome: usuario.nome, pode };
}
export type AutorFatura = Awaited<ReturnType<typeof autorFatura>>;
export async function auditarFatura(tx: Prisma.TransactionClient, autor: AutorFatura, acao: string, alvoId: string, faturaId: string | null, antes: unknown, depois: unknown, motivo?: string) {
  const json = (d: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(d ?? {}));
  await tx.historicoCartao.create({ data: { acao, alvoId, faturaId, autorId: autor.id, autorNome: autor.nome,
    antes: json(antes), depois: json(depois), motivo } });
}
