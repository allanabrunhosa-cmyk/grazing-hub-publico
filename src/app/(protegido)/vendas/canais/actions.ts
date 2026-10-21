"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { salvarCanalVenda, type CanalEntrada } from "@/lib/vendas/canais";
import { ErroCadastroVenda } from "@/lib/vendas/dominio";

export async function salvarCanalVendaAction(entrada: CanalEntrada) {
  const sessao = await exigirPermissao("vendas.produtos", "editar");
  try {
    await salvarCanalVenda(entrada, sessao);
    revalidatePath("/vendas", "layout");
    return { ok: true as const };
  } catch (erro) {
    return { erro: erro instanceof ErroCadastroVenda ? erro.message : "Não foi possível salvar. Confira o cadastro antes de repetir." };
  }
}
