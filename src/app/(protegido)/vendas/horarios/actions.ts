"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { salvarHorariosPedidos } from "@/lib/vendas/pedidos-horarios";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { ErroHorariosEntrega } from "@/lib/vendas/horarios-entrega-dominio";
export async function salvarHorariosAction(valor: unknown, versao: number, chave?: string): Promise<{ versao: number } | { erro: string }> {
  const sessao = await exigirPermissao("vendas.horarios", "editar");
  try { const salvo = await salvarHorariosPedidos(valor, versao, sessao, chave); revalidatePath("/vendas/horarios"); revalidatePath("/vendas/pedidos", "layout"); return { ...salvo }; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda || e instanceof ErroHorariosEntrega ? e.message : "Não foi possível salvar os horários." }; }
}
