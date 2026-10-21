"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ativarVersaoFiscal, analisarImpactoFiscal, consultarPainelFiscal, registrarDeclaracaoGrazing1PelaInstrucao, salvarVersaoFiscal } from "@/lib/tributacao/servico";
import type { EntradaDeclaracaoGrazing1 } from "@/lib/tributacao/declaracao-fci-contrato";
import type { SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";
import { ErroEstruturaFiscal } from "@/lib/tributacao/validacao";
const mensagem = (e: unknown) => e instanceof ErroEstruturaFiscal ? e.message : "Não foi possível concluir a operação fiscal. Atualize o painel e confira os dados.";
export async function registrarDeclaracaoGrazing1Action(entrada: EntradaDeclaracaoGrazing1) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { const r = await registrarDeclaracaoGrazing1PelaInstrucao(entrada, sessao); revalidatePath("/vendas", "layout"); revalidatePath("/financeiro/fiscal/cobertura"); return { ok: true as const, ...r }; } catch (e) { return { erro: mensagem(e) }; }
}
export async function salvarVersaoFiscalAction(entrada: SalvarVersaoFiscalEntrada) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { const r = await salvarVersaoFiscal(entrada, sessao); revalidatePath("/vendas", "layout"); revalidatePath("/financeiro/fiscal/cobertura"); return { ok: true as const, ...r }; } catch (e) { return { erro: mensagem(e) }; }
}
export async function analisarImpactoFiscalAction(id: string) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { return { ok: true as const, impacto: await analisarImpactoFiscal(id, sessao) }; } catch (e) { return { erro: mensagem(e) }; }
}
export async function ativarVersaoFiscalAction(id: string, hashImpacto: string, chaveOperacao: string) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { const r = await ativarVersaoFiscal(id, hashImpacto, chaveOperacao, sessao); revalidatePath("/vendas", "layout"); revalidatePath("/financeiro/fiscal/cobertura"); return { ok: true as const, ...r }; } catch (e) { return { erro: mensagem(e) }; }
}
export async function consultarPainelFiscalAction() {
  const sessao = await exigirPermissao("vendas.fiscal");
  try { return { ok: true as const, painel: await consultarPainelFiscal(sessao) }; } catch (e) { return { erro: mensagem(e) }; }
}
