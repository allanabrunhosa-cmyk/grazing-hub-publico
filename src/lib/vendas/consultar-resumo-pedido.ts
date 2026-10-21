import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { calcularPedido } from "./pedidos";
import { ErroPedidoVenda, validarEntradaPedido } from "./pedidos-dominio";
import { dadosResumoPedido } from "./resumo-pedido";

type Valor = string | Prisma.Decimal;
function valoresDosItens<T extends { precoAplicado: Valor; acrescimos: Valor; totalLinha: Valor; desconto: Valor }>(itens: T[]) {
  return itens.map(i => ({ ...i, precoUnitarioResumo: new Prisma.Decimal(i.precoAplicado).plus(i.acrescimos).toFixed(2), totalResumo: new Prisma.Decimal(i.totalLinha).plus(i.desconto).toFixed(2) }));
}

/** Consulta comercial sem confirmação, reservas, financeiro, auditoria de mutação ou escrita. */
export async function consultarResumoPedido(id: string) {
  if (typeof id !== "string" || !id.trim() || id.length > 100) throw new ErroPedidoVenda("Pedido inválido.");
  return prisma.$transaction(async tx => {
    const pedido = await tx.pedidoVenda.findUnique({ where: { id }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } });
    if (!pedido) throw new ErroPedidoVenda("Pedido não encontrado.");
    if (["RASCUNHO", "DECLINADO"].includes(pedido.status)) {
      const entrada = validarEntradaPedido(pedido.rascunho);
      // Um orçamento completo usa a mesma precisão/preços do domínio. Pagamento é opcional.
      const calculado = await calcularPedido(tx, entrada);
      // A confirmação normaliza o frete de retirada após calcular os itens.
      // Entrega conserva o frete informado; snapshots de pedidos históricos não são recalculados.
      if (entrada.atendimento === "RETIRADA") {
        calculado.frete = "0.00";
        calculado.total = new Prisma.Decimal(calculado.subtotal).minus(calculado.desconto).plus(calculado.outrosCustos).toFixed(2);
      }
      return dadosResumoPedido(JSON.parse(JSON.stringify({ ...pedido, ...calculado, itens: valoresDosItens(calculado.itens) })) as Record<string, unknown>);
    }
    // Confirmados/cancelados usam somente os snapshots e valores comerciais históricos.
    return dadosResumoPedido(JSON.parse(JSON.stringify({ ...pedido, itens: valoresDosItens(pedido.itens) })) as Record<string, unknown>);
  }, { isolationLevel: "RepeatableRead", timeout: 30000 });
}
