"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { ErroRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { salvarRascunhoRegraTributariaBrasilNfe, aprovarRegraTributariaBrasilNfe, inativarRegraTributariaBrasilNfe, obterHistoricoRegraTributariaBrasilNfe, enviarRegraParaRevisaoBrasilNfe, bloquearRegraTributariaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias";
import type { RespostaAcaoRegraBrasilNfe } from "./tipos";

export async function salvarRascunhoRegraBrasilNfeAction(entrada: unknown): Promise<RespostaAcaoRegraBrasilNfe> {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    await salvarRascunhoRegraTributariaBrasilNfe(entrada, sessao);
    revalidatePath("/vendas/fiscal/regras-brasilnfe");
    revalidatePath("/financeiro/fiscal/regras-brasilnfe");
    return { ok: true };
  } catch (erro) {
    return erro instanceof ErroRegraFiscalBrasilNfe ? { erro: erro.message, campo: erro.campo } : { erro: "Não foi possível salvar a decisão tributária. Seu preenchimento foi mantido." };
  }
}
export async function aprovarRegraBrasilNfeAction(entrada: unknown): Promise<RespostaAcaoRegraBrasilNfe> {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    await aprovarRegraTributariaBrasilNfe(entrada, sessao);
    revalidatePath("/vendas/fiscal/regras-brasilnfe");
    revalidatePath("/financeiro/fiscal/regras-brasilnfe");
    return { ok: true };
  } catch (erro) {
    return erro instanceof ErroRegraFiscalBrasilNfe ? { erro: erro.message, campo: erro.campo } : { erro: "Não foi possível aprovar. Confira a revisão, a fundamentação e a aplicação ao caso." };
  }
}
export async function revisarRegraBrasilNfeAction(entrada: unknown): Promise<RespostaAcaoRegraBrasilNfe> {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    await enviarRegraParaRevisaoBrasilNfe(entrada, sessao);
    revalidatePath("/vendas/fiscal/regras-brasilnfe");
    revalidatePath("/financeiro/fiscal/regras-brasilnfe");
    return { ok: true };
  } catch (erro) {
    return erro instanceof ErroRegraFiscalBrasilNfe ? { erro: erro.message, campo: erro.campo } : { erro: "Não foi possível enviar para revisão. Confira a revisão atual." };
  }
}
export async function bloquearRegraBrasilNfeAction(entrada: unknown): Promise<RespostaAcaoRegraBrasilNfe> {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    await bloquearRegraTributariaBrasilNfe(entrada, sessao);
    revalidatePath("/vendas/fiscal/regras-brasilnfe");
    revalidatePath("/financeiro/fiscal/regras-brasilnfe");
    return { ok: true };
  } catch (erro) {
    return erro instanceof ErroRegraFiscalBrasilNfe ? { erro: erro.message, campo: erro.campo } : { erro: "Não foi possível bloquear a decisão. Confira a revisão atual." };
  }
}
export async function inativarRegraBrasilNfeAction(entrada: unknown): Promise<RespostaAcaoRegraBrasilNfe> {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    await inativarRegraTributariaBrasilNfe(entrada, sessao);
    revalidatePath("/vendas/fiscal/regras-brasilnfe");
    revalidatePath("/financeiro/fiscal/regras-brasilnfe");
    return { ok: true };
  } catch (erro) {
    return erro instanceof ErroRegraFiscalBrasilNfe ? { erro: erro.message, campo: erro.campo } : { erro: "Não foi possível inativar. Confira a revisão atual." };
  }
}
export async function historicoRegraBrasilNfeAction(id: string) {
  const sessao = await exigirPermissao("vendas.fiscal", "visualizar");
  try {
    const historico = await obterHistoricoRegraTributariaBrasilNfe(id, sessao);
    const responsaveis = await prisma.usuario.findMany({ where: { id: { in: [...new Set(historico.versoes.map(v => v.responsavelId))] } }, select: { id: true, nome: true } });
    return { ok: true as const, historico, responsaveis: Object.fromEntries(responsaveis.map(r => [r.id, r.nome])) };
  }
  catch { return { erro: "Não foi possível consultar esta decisão tributária. Atualize a página." }; }
}
