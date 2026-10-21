"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { salvarCliente, mensagemErroCadastro } from "@/lib/vendas/persistencia";
import { ErroCadastroVenda, type ClienteEntrada } from "@/lib/vendas/dominio";

import { consultarCnpjVenda } from "@/lib/vendas/cnpj";
import { consultarCepVenda } from "@/lib/vendas/cep";
import { validarClienteNovoPedido } from "@/lib/vendas/cliente-pedido";

export async function buscarCepPedidoAction(cep: string) {
  await exigirPermissao("vendas.pedidos");
  return consultarCepVenda(cep);
}

export async function criarClienteDoPedidoAction(entrada: ClienteEntrada) {
  const autor = await exigirPermissao("vendas.clientes", "adicionar");
  try {
    const validado = validarClienteNovoPedido(entrada);
    const id = await salvarCliente(validado, autor);
    revalidatePath("/vendas", "layout");
    return { id, nome: validado.nome, primeiroNome: validado.primeiroNome ?? "", sobrenome: validado.sobrenome ?? "", tipo: validado.tipo, documento: validado.documento, telefone: validado.telefone, endereco: validado.enderecos[0] };
  } catch (erro) { return { erro: erro instanceof ErroCadastroVenda ? erro.message : mensagemErroCadastro(erro) }; }
}

export async function buscarCnpjPedidoAction(cnpj: string) {
  await exigirPermissao("vendas.pedidos");
  return consultarCnpjVenda(cnpj);
}
