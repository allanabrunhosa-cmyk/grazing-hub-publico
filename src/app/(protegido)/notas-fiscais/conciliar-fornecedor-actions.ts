"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { camposFornecedor, extrairFornecedorNota, type CampoFornecedor, type PreviaFornecedorNota } from "@/lib/notas-fiscais/dados-fornecedor";

class ErroConciliacaoFornecedor extends Error {}

async function preparar(banco: Prisma.TransactionClient, notaId: string, fornecedorId?: string | null): Promise<PreviaFornecedorNota> {
  const nota = await banco.notaFiscalRecebida.findUnique({ where: { id: notaId } });
  if (!nota?.xml || nota.tipo !== "PROC_NFE") throw new ErroConciliacaoFornecedor("Aguarde o XML completo para conciliar o fornecedor.");
  let dados;
  try { dados = extrairFornecedorNota(nota.xml, nota.fornecedorCnpj, nota.chaveAcesso); }
  catch { throw new ErroConciliacaoFornecedor("Não foi possível conferir os dados do emitente no XML desta nota."); }
  const vinculo = await banco.fornecedorNotaVinculo.findUnique({ where: { cnpj: dados.cnpj! } });
  const porCnpj = await banco.fornecedor.findUnique({ where: { cnpj: dados.cnpj! }, select: { id: true, ativo: true } });
  let id = fornecedorId === undefined ? (vinculo?.fornecedorId ?? (porCnpj?.ativo ? porCnpj.id : null)) : fornecedorId;
  let fornecedor = id ? await banco.fornecedor.findUnique({ where: { id } }) : null;
  if (id && !fornecedor?.ativo) {
    if (fornecedorId) throw new ErroConciliacaoFornecedor("Escolha um fornecedor ativo. O vínculo anterior não está disponível.");
    id = null;
    fornecedor = null;
  }
  const atual = fornecedor ? { nome: fornecedor.nome, razaoSocial: fornecedor.razaoSocial, cnpj: fornecedor.cnpj, telefone: fornecedor.telefone } : null;
  return {
    fornecedorId: id,
    fornecedores: await banco.fornecedor.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    atual, nota: dados,
    campos: camposFornecedor.filter(campo => dados[campo] != null && dados[campo] !== atual?.[campo]),
    versao: createHash("sha256").update(JSON.stringify([nota.xml, fornecedor?.id, fornecedor?.updatedAt, atual, vinculo])).digest("hex"),
    vinculoAnterior: vinculo?.fornecedorId ?? null,
  };
}

export async function prepararConciliacaoFornecedorAction(notaId: string, fornecedorId?: string | null): Promise<PreviaFornecedorNota | { erro: string }> {
  await exigirPermissao("notas", "visualizar");
  if (!(await getSession())) return { erro: "Sua sessão expirou. Entre novamente." };
  if (typeof notaId !== "string" || !notaId || (fornecedorId != null && typeof fornecedorId !== "string")) return { erro: "Seleção inválida." };
  try { return await preparar(prisma, notaId, fornecedorId); }
  catch (erro) { return { erro: erro instanceof ErroConciliacaoFornecedor ? erro.message : "Não foi possível carregar o fornecedor. Tente novamente." }; }
}

export async function conciliarFornecedorNotaAction(entrada: {
  notaId: string; fornecedorId: string; versao: string; campos: CampoFornecedor[];
}): Promise<{ fornecedor: { id: string; nome: string; memorizado: true } } | { erro: string }> {
  await exigirPermissao("notas.manifestar", "editar");
  await exigirPermissao("notas", "visualizar");
  await exigirPermissao("fornecedores", "editar");
  const sessao = await getSession();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
  if (!entrada || typeof entrada.notaId !== "string" || !entrada.notaId || typeof entrada.fornecedorId !== "string" || !entrada.fornecedorId ||
    typeof entrada.versao !== "string" || !Array.isArray(entrada.campos) || entrada.campos.some(c => !camposFornecedor.includes(c))) return { erro: "Dados de conciliação inválidos." };
  try {
    const fornecedor = await prisma.$transaction(async banco => {
      const [trava] = await banco.$queryRaw<{ obtida: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('aceite-nota'), hashtext(${entrada.notaId})) AS obtida`;
      if (!trava?.obtida) throw new ErroConciliacaoFornecedor("Esta nota está sendo atualizada. Aguarde e tente novamente.");
      await banco.$queryRaw`SELECT id FROM "NotaFiscalRecebida" WHERE id = ${entrada.notaId} FOR UPDATE`;
      const nota = await banco.notaFiscalRecebida.findUnique({ where: { id: entrada.notaId }, select: { fornecedorCnpj: true } });
      if (!nota?.fornecedorCnpj) throw new ErroConciliacaoFornecedor("Nota sem CNPJ do fornecedor.");
      await banco.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('fornecedor-nota'), hashtext(${nota.fornecedorCnpj}))::text`;
      await banco.$queryRaw`SELECT id FROM "Fornecedor" WHERE id = ${entrada.fornecedorId} FOR UPDATE`;
      const previa = await preparar(banco, entrada.notaId, entrada.fornecedorId);
      if (previa.versao !== entrada.versao) throw new ErroConciliacaoFornecedor("O cadastro ou o vínculo mudou. Reabra a conferência antes de salvar.");
      const dados: Partial<Record<CampoFornecedor, string>> = {};
      for (const campo of new Set(entrada.campos)) {
        if (previa.campos.includes(campo) && previa.nota[campo] != null) dados[campo] = previa.nota[campo]!;
      }
      // Valores sempre relidos do XML no servidor; campos ausentes preservam o cadastro.
      const atualizado = await banco.fornecedor.update({ where: { id: entrada.fornecedorId }, data: dados, select: { id: true, nome: true } });
      const memoria = {
        fornecedorId: atualizado.id, notaOrigemId: entrada.notaId, usuarioId: sessao.userId,
        atualizacao: { anterior: previa.atual!, aplicado: dados },
      };
      await banco.fornecedorNotaVinculo.upsert({
        where: { cnpj: previa.nota.cnpj! },
        create: { cnpj: previa.nota.cnpj!, ...memoria }, update: memoria,
      });
      return { ...atualizado, memorizado: true as const };
    });
    revalidatePath("/notas-fiscais");
    revalidatePath("/fornecedores");
    return { fornecedor };
  } catch (erro) {
    if (erro instanceof ErroConciliacaoFornecedor) return { erro: erro.message };
    if (erro && typeof erro === "object" && "code" in erro && erro.code === "P2002") return { erro: "Este CNPJ já pertence a outro cadastro. Selecione esse fornecedor ou mantenha o CNPJ atual desmarcando sua atualização." };
    return { erro: "Não foi possível conciliar o fornecedor. Reabra a conferência e tente novamente." };
  }
}
