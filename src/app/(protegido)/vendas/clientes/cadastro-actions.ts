"use server";

import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarCnpjVenda } from "@/lib/vendas/cnpj";
import { consultarCepVenda } from "@/lib/vendas/cep";

export async function buscarCepClienteAction(cep: string) {
  await exigirPermissao("vendas.clientes");
  return consultarCepVenda(cep);
}

export async function buscarCnpjClienteAction(cnpj: string) {
  await exigirPermissao("vendas.clientes");
  return consultarCnpjVenda(cnpj);
}
