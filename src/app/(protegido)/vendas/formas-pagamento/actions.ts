"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { salvarFormaPagamentoVenda } from "@/lib/vendas/persistencia-formas-pagamento";
import { mensagemErroCadastro } from "@/lib/vendas/persistencia";
import type { FormaPagamentoVendaEntrada } from "@/lib/vendas/formas-pagamento";

export async function salvarFormaPagamentoVendaAction(entrada: FormaPagamentoVendaEntrada) {
  const autor = await exigirPermissao("vendas.formas-pagamento", entrada?.id ? "editar" : "adicionar");
  try {
    const id = await salvarFormaPagamentoVenda(entrada, autor);
    revalidatePath("/vendas/formas-pagamento");
    return { ok: true as const, id };
  } catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
