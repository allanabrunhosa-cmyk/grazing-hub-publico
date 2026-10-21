import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { INCLUIR_AUTORIZACAO, escoposDaAutorizacao } from "./servidor";

// O recibo autoriza um efeito específico. A fila não conserva privilégios após
// suspensão/revogação, troca de sessão ou redução do consentimento central.
export async function permitirEfeitoPendenteMcp(tx: Prisma.TransactionClient, operacaoId: string, usuarioId: string, lojaId = "singleton") {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const op = await tx.mcpOperacao.findUnique({ where: { id: operacaoId } });
  if (!op || op.estado !== "EXECUTADA" || op.usuarioId !== usuarioId || op.expiraEm <= new Date()) return false;
  const [a, config] = await Promise.all([
    tx.mcpAutorizacao.findUnique({ where: { id: op.autorizacaoId }, include: INCLUIR_AUTORIZACAO }),
    tx.mcpConfiguracao.findUnique({ where: { id: "singleton" } }),
  ]);
  const referencias = op.referencias && typeof op.referencias === "object" && !Array.isArray(op.referencias) ? op.referencias : {};
  return !!(config?.ativo && a && a.usuarioId === usuarioId && a.lojaId === lojaId &&
    a.situacao === "ATIVA" && a.cliente.ativo && a.usuario.ativo && !a.usuario.excluidoEm &&
    a.versao === referencias.versaoOAuth && a.usuario.sessaoVersao === referencias.sessaoVersao &&
    escoposDaAutorizacao(a).includes(`hub:v2:${op.ferramenta}`));
}
