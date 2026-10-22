"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { salvarFiscalSimples, salvarGrupoFiscalSimples, salvarEmpresaFiscalSimples, type EdicaoFiscalSimples, type EdicaoGrupoFiscalSimples, type EdicaoEmpresaFiscalSimples } from "@/lib/tributacao/edicao-simples";
import { ErroEstruturaFiscal } from "@/lib/tributacao/validacao";
const erroFiscal = (e: unknown) => e instanceof ErroEstruturaFiscal ? e.message : "Não foi possível salvar. Reabra o cadastro para conferir o resultado antes de repetir.";
function atualizar() { revalidatePath("/financeiro/fiscal", "layout"); revalidatePath("/vendas", "layout"); }
export async function salvarFiscalSimplesAction(e: EdicaoFiscalSimples) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { await salvarFiscalSimples(e, sessao); atualizar(); return { ok: true as const }; } catch (e) { return { erro: erroFiscal(e) }; }
}
export async function salvarGrupoFiscalSimplesAction(e: EdicaoGrupoFiscalSimples) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { const id = await salvarGrupoFiscalSimples(e, sessao); atualizar(); return { ok: true as const, id }; } catch (e) { return { erro: erroFiscal(e) }; }
}
export async function salvarEmpresaFiscalSimplesAction(e: EdicaoEmpresaFiscalSimples) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { await salvarEmpresaFiscalSimples(e, sessao); atualizar(); return { ok: true as const }; } catch (e) { return { erro: erroFiscal(e) }; }
}
