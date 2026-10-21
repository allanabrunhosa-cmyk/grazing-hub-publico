"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function dataValida(data: unknown): data is string {
  return typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)
    && Number.isFinite(Date.parse(data)) && new Date(data).toISOString().slice(0, 10) === data;
}

export async function reagendarPedidoAction(input: {
  pedidoId: string;
  previsaoAnterior: string | null;
  previsaoEntrega: string;
}): Promise<{ erro: string } | { ok: true; previsaoEntrega: string }> {
  await exigirPermissao("compras", "editar");
  const sessao = await getSession();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
  if (!input || typeof input.pedidoId !== "string" || !input.pedidoId
    || !dataValida(input.previsaoEntrega)
    || (input.previsaoAnterior !== null && !dataValida(input.previsaoAnterior))) {
    return { erro: "Informe uma data de entrega válida." };
  }

  try {
    const resultado = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "PedidoCompra" WHERE "id" = ${input.pedidoId} FOR UPDATE`;
      const pedido = await tx.pedidoCompra.findUnique({ where: { id: input.pedidoId } });
      if (!pedido || pedido.excluidoEm) return { erro: "Pedido não encontrado ou excluído." };
      if (pedido.status !== "CONFIRMADO") return { erro: "Somente pedidos pendentes podem ser reagendados." };
      const anterior = pedido.previsaoEntrega?.toISOString().slice(0, 10) ?? null;
      if (anterior !== input.previsaoAnterior) return { erro: "A data deste pedido foi alterada. Atualize a página antes de reagendar." };
      if (anterior === input.previsaoEntrega) return { ok: true as const, previsaoEntrega: pedido.previsaoEntrega!.toISOString() };
      const previsaoEntrega = new Date(`${input.previsaoEntrega}T12:00:00`);
      await tx.pedidoCompra.update({ where: { id: pedido.id }, data: { previsaoEntrega } });
      const formatar = (data: string) => data.split("-").reverse().join("/");
      await tx.pedidoCompraHistorico.create({ data: {
        pedidoId: pedido.id, acao: "REAGENDAMENTO", statusAnterior: pedido.status, statusNovo: pedido.status,
        motivo: `Previsão de entrega: ${anterior ? formatar(anterior) : "sem data"} → ${formatar(input.previsaoEntrega)}.`,
        usuarioId: sessao.userId, usuarioNome: sessao.nome,
      } });
      return { ok: true as const, previsaoEntrega: previsaoEntrega.toISOString() };
    });
    if ("ok" in resultado) revalidatePath("/compras");
    return resultado;
  } catch {
    return { erro: "Não foi possível reagendar o pedido. Tente novamente." };
  }
}
