import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { ErroCadastroVenda } from "./dominio";

type Banco = Prisma.TransactionClient;
type Autor = { userId: string; nome: string };
/** O JSONB original pode conter números que não cabem em Number. Nunca reserializar o restante. */
export async function lerFiscalTexto(tx: Banco, produtoId: string) {
  const linhas = await tx.$queryRaw<{ fiscalTexto: string }[]>`SELECT fiscal::text AS "fiscalTexto" FROM "ProdutoVenda" WHERE id=${produtoId} FOR UPDATE`;
  if (!linhas.length) throw new ErroCadastroVenda("Produto fiscal não encontrado.");
  return linhas[0].fiscalTexto;
}
export async function mesclarFiscalJsonb(tx: Banco, produtoId: string, patch: Record<string, unknown>) {
  const atualizado = await tx.$queryRaw<{ fiscalTexto: string }[]>`UPDATE "ProdutoVenda" SET fiscal=fiscal || ${JSON.stringify(patch)}::jsonb WHERE id=${produtoId} AND jsonb_typeof(fiscal)='object' RETURNING fiscal::text AS "fiscalTexto"`;
  if (!atualizado.length) throw new ErroCadastroVenda("Cadastro fiscal não é um objeto válido; preservar e corrigir sua estrutura.");
  return atualizado[0].fiscalTexto;
}
/** Usa a auditoria existente; apenas a fotografia de fiscal é substituída pelo JSONB exato. */
export async function historicoFiscalJsonb(tx: Banco, autor: Autor, entidade: "FISCAL" | "PRODUTO", registroId: string, antes: unknown, depois: unknown, fiscalAntesTexto: string | null) {
  const fonteId = randomUUID();
  const semFiscal = (valor: unknown) => valor === null ? null : JSON.stringify({ ...(valor as Record<string, unknown>), fiscal: null });
  await tx.$executeRaw`INSERT INTO "HistoricoCadastroVenda" (id,entidade,"registroId","usuarioId","usuarioNome",antes,depois)
    SELECT ${fonteId},${entidade},${registroId},${autor.userId},${autor.nome},
      CASE WHEN ${fiscalAntesTexto}::text IS NULL THEN NULL ELSE jsonb_set(${semFiscal(antes)}::jsonb,'{fiscal}',${fiscalAntesTexto}::jsonb) END,
      jsonb_set(${semFiscal(depois)}::jsonb,'{fiscal}',p.fiscal)
    FROM "ProdutoVenda" p WHERE p.id=${registroId}`;
  return fonteId;
}
export async function lerFiscalGrupoTexto(tx: Banco, id: string) {
  const linhas = await tx.$queryRaw<{ fiscalTexto: string }[]>`SELECT fiscal::text AS "fiscalTexto" FROM "GrupoFiscalVenda" WHERE id=${id} FOR UPDATE`;
  if (!linhas.length) throw new ErroCadastroVenda("Grupo fiscal não encontrado."); return linhas[0].fiscalTexto;
}
export async function mesclarFiscalGrupoJsonb(tx: Banco, id: string, patch: Record<string, unknown>) {
  const linhas = await tx.$queryRaw<{ fiscalTexto: string }[]>`UPDATE "GrupoFiscalVenda" SET fiscal=fiscal || ${JSON.stringify(patch)}::jsonb WHERE id=${id} AND jsonb_typeof(fiscal)='object' RETURNING fiscal::text AS "fiscalTexto"`;
  if (!linhas.length) throw new ErroCadastroVenda("Parâmetros fiscais do grupo não são objeto válido; preservar e corrigir sua estrutura."); return linhas[0].fiscalTexto;
}
export async function historicoFiscalGrupoJsonb(tx: Banco, autor: Autor, registroId: string, antes: unknown, depois: unknown, fiscalAntesTexto: string | null) {
  const fonteId = randomUUID(), semFiscal = (v: unknown) => v === null ? null : JSON.stringify({ ...(v as Record<string, unknown>), fiscal: null });
  await tx.$executeRaw`INSERT INTO "HistoricoCadastroVenda" (id,entidade,"registroId","usuarioId","usuarioNome",antes,depois)
    SELECT ${fonteId},'GRUPO_FISCAL',${registroId},${autor.userId},${autor.nome},
      CASE WHEN ${fiscalAntesTexto}::text IS NULL THEN NULL ELSE jsonb_set(${semFiscal(antes)}::jsonb,'{fiscal}',${fiscalAntesTexto}::jsonb) END,
      jsonb_set(${semFiscal(depois)}::jsonb,'{fiscal}',p.fiscal) FROM "GrupoFiscalVenda" p WHERE p.id=${registroId}`;
  return fonteId;
}
