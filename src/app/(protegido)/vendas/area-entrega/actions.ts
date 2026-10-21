"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { calcularEntrega, salvarEntregas, type EntradaCalculoEntrega } from "@/lib/vendas/entregas";
import { validarEnderecoEntrega } from "@/lib/vendas/entregas-dominio";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { consultarCepVenda } from "@/lib/vendas/cep";
export async function buscarCepEntregaAction(cep: string) {
  await exigirPermissao("vendas.area-entrega");
  return consultarCepVenda(cep);
}
export async function salvarEntregasAction(valor: unknown, versao: number) {
  const sessao = await exigirPermissao("vendas.area-entrega", "editar");
  try {
    if (!valor || typeof valor !== "object" || !("modelo" in valor) || valor.modelo !== "SLOTS") throw new ErroPedidoVenda("Reabra Entregas para configurar o frete por veículo e slots.");
    const r = await salvarEntregas(valor, versao, sessao); revalidatePath("/vendas/area-entrega"); revalidatePath("/configuracoes/entregas"); revalidatePath("/vendas/pedidos", "layout"); return r;
  }
  catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível salvar Entregas." }; }
}
export async function simularEntregaAction(entrada: EntradaCalculoEntrega) {
  const sessao = await exigirPermissao("vendas.area-entrega");
  try {
    if (typeof entrada.veiculoEntregaId !== "string" || !entrada.veiculoEntregaId || entrada.veiculoEntregaId.length > 100) throw new ErroPedidoVenda("Selecione o veículo da simulação.");
    const resultado = await calcularEntrega({ atendimento: "ENTREGA", clienteId: null, endereco: entrada.endereco ? validarEnderecoEntrega(entrada.endereco) : null, subtotalProdutos: "0.00", veiculoEntregaId: entrada.veiculoEntregaId }, sessao);
    return { resultado };
  } catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível simular. Tente novamente." }; }
}
