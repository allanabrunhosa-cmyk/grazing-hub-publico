"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { revalidatePath } from "next/cache";
import { ErroExtrato } from "@/lib/financeiro/conciliacao/arquivo";
import { prepararExtrato, importarExtrato, conciliarExtrato, desfazerConciliacao } from "@/lib/financeiro/conciliacao/servico";
import type { EntradaConciliacao } from "@/lib/financeiro/conciliacao/types";
function erroOperacao(erro: unknown) { return { erro: erro instanceof ErroExtrato ? erro.message : "Não foi possível concluir. Atualize a tela e tente novamente." }; }
function revalidar() {
  for (const rota of ["/financeiro", "/financeiro/movimentacoes", "/financeiro/contas", "/financeiro/bancario", "/financeiro/lancamentos", "/financeiro/fluxo-de-caixa"]) revalidatePath(rota);
}
export async function prepararExtratoAction(formulario: FormData) {
  await exigirPermissao("financeiro.conciliacao", "adicionar");
  await exigirPermissao("financeiro.movimentacoes");
  try { return { previa: await prepararExtrato(formulario) }; } catch (erro) { return erroOperacao(erro); }
}
export async function importarExtratoAction(formulario: FormData) {
  const sessao = await exigirPermissao("financeiro.conciliacao", "adicionar");
  await exigirPermissao("financeiro.movimentacoes");
  try { const resultado = await importarExtrato(formulario, sessao); revalidar(); return resultado; } catch (erro) { return erroOperacao(erro); }
}
export async function conciliarExtratoAction(input: EntradaConciliacao) {
  const sessao = await exigirPermissao("financeiro.conciliacao", "editar");
  await exigirPermissao("financeiro.movimentacoes");
  try { const resultado = await conciliarExtrato(input, sessao); revalidar(); return resultado; } catch (erro) { return erroOperacao(erro); }
}
export async function desfazerConciliacaoAction(transacaoId: string, motivo: string) {
  const sessao = await exigirPermissao("financeiro.conciliacao", "excluir");
  await exigirPermissao("financeiro.movimentacoes");
  try { const resultado = await desfazerConciliacao(transacaoId, motivo, sessao); revalidar(); return resultado; } catch (erro) { return erroOperacao(erro); }
}
