"use server";

import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { consultarBiVendas } from "@/lib/vendas/bi-consultas";
import { ErroBi } from "@/lib/vendas/bi-filtros";
import type { FiltrosBi, ResultadoBi } from "@/lib/vendas/bi-types";

export async function consultarBiAction(entrada: Partial<FiltrosBi>): Promise<ResultadoBi | { erro: string }> {
  await exigirPermissao("vendas.bi");
  const [contatos, custos, exportar, pedidos] = await Promise.all([
    podeAcessar("vendas.bi.contatos"), podeAcessar("vendas.bi.custos"),
    podeAcessar("vendas.bi.exportar"), podeAcessar("vendas.pedidos"),
  ]);
  try {
    return await consultarBiVendas(entrada, { contatos, custos, exportar, pedidos });
  } catch (erro) {
    return { erro: erro instanceof ErroBi ? erro.message : "Não foi possível consultar o Dashboard. Tente novamente." };
  }
}
