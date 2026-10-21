"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { calcularItensFretePedido, validarEntradaFretePedido } from "@/lib/vendas/pedidos-frete";
import { calcularEntrega } from "@/lib/vendas/entregas";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
export async function calcularFretePedidoAction(valor: unknown) {
  const sessao = await exigirPermissao("vendas.pedidos");
  try {
    const d = validarEntradaFretePedido(valor);
    const produtos = await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["consultar"]); return calcularItensFretePedido(tx, d); });
    const resultado = await calcularEntrega({ clienteId: d.clienteId, atendimento: d.atendimento!, endereco: d.endereco, ...produtos, veiculoEntregaId: d.veiculoEntregaId }, sessao);
    return { resultado };
  } catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível calcular o frete. Tente novamente." }; }
}
