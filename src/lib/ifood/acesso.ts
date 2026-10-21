import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import type { SessaoAtual } from "@/lib/session";
import { ErroIfood } from "./dominio";

export async function acessoIfood(tx: Prisma.TransactionClient, sessao: Pick<SessaoAtual, "userId" | "versao">, recurso = "vendas.pedidos", configurar = false, escrita = true) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroIfood("Sessão encerrada.");
  const admin = u.perfilAcesso?.sistema === "ADMINISTRADOR";
  if (!admin && (configurar || !permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, u.permissoesPersonalizadas as Excecoes, recurso, escrita ? "editar" : "visualizar"))) throw new ErroIfood("Seu acesso não permite esta operação.");
  return { id: u.id, nome: u.nome };
}
export function exigirConta(contaId: string) {
  if (contaId !== "singleton") throw new ErroIfood("Integração fora da conta desta instalação.");
}
export function recursoAcao(acao: string) {
  return acao === "confirm" ? "vendas.pedidos.confirmar" : ["requestCancellation", "acceptDispute", "rejectDispute", "alternativeDispute"].includes(acao) ? "vendas.pedidos.cancelar" : ["startPreparation", "readyToPickup"].includes(acao) ? "vendas.pedidos.producao" : "vendas.pedidos.revisar";
}
