"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { registrarProducaoPreparacao, corrigirProducaoPreparacao, ErroProducaoPreparacao, type EntradaProducao } from "@/lib/estoque/producao-preparacao";
function atualizar() { revalidatePath("/inventario", "layout"); revalidatePath("/insumos"); }
export async function registrarProducaoPreparacaoAction(dados: EntradaProducao) {
  const sessao = await exigirPermissao("inventario", "editar");
  try { await registrarProducaoPreparacao(dados, sessao); atualizar(); return { ok: true as const }; }
  catch (e) { return { erro: e instanceof ErroProducaoPreparacao ? e.message : "Não foi possível registrar. O preenchimento foi mantido; confira o histórico antes de repetir." }; }
}
export async function corrigirProducaoPreparacaoAction(id: string, motivo: string, chave: string) {
  const sessao = await exigirPermissao("inventario", "editar");
  try { await corrigirProducaoPreparacao(id, motivo, chave, sessao); atualizar(); return { ok: true as const }; }
  catch (e) { return { erro: e instanceof ErroProducaoPreparacao ? e.message : "Não foi possível corrigir. Confira reservas e movimentos antes de repetir." }; }
}
