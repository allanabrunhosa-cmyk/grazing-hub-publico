"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { manterNcmRevisado } from "@/lib/tributacao/revisao-ncm";
import { ErroEstruturaFiscal } from "@/lib/tributacao/validacao";

/** Ato explícito do responsável: mantém o NCM vigente para a composição atual.
 * A guarda de administrador fiscal é conferida de novo no serviço, dentro da transação. */
export async function manterNcmRevisadoAction(entrada: { versaoId: string; assinatura: string; chaveOperacao: string }) {
  const sessao = await exigirPermissao("financeiro.fiscal.painel");
  if (!entrada || [entrada.versaoId, entrada.assinatura, entrada.chaveOperacao].some(v => typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(v))) return { erro: "Revisão inválida. Atualize a página." };
  try { await manterNcmRevisado(entrada, sessao); }
  catch (e) { return { erro: e instanceof ErroEstruturaFiscal ? e.message : "Não foi possível manter o NCM. Atualize a página e tente novamente, ou abra a ficha fiscal do produto." }; }
  revalidatePath("/financeiro/fiscal"); revalidatePath("/vendas", "layout");
  return { ok: true as const };
}
