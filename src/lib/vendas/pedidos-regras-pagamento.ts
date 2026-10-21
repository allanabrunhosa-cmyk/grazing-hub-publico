import { Prisma } from "@/generated/prisma/client";
import { ErroPedidoVenda } from "./pedidos-dominio";
import { diaNoFuso, somarDias } from "./pedidos-agenda-dominio";

type RegrasCliente = { formasPagamentoHabilitadas: unknown; boletoDiasAposEntrega: number | null; limiteCreditoAberto: Prisma.Decimal | null };
type DataEntregaPedido = { previsaoData: Date | null; entregueEm?: Date | null; confirmadoEm?: Date | null; fusoHorario: string };

export function exigirFormaPagamentoCliente(regras: Pick<RegrasCliente, "formasPagamentoHabilitadas">, formaId: string) {
  if (regras.formasPagamentoHabilitadas !== null && (!Array.isArray(regras.formasPagamentoHabilitadas) || !regras.formasPagamentoHabilitadas.includes(formaId))) {
    throw new ErroPedidoVenda("A forma de pagamento não está habilitada para este cliente.");
  }
}

/** Previsão é data civil; instantes de entrega/confirmação usam o fuso persistido do pedido. */
export function exigirVencimentoBoletoCliente(regras: Pick<RegrasCliente, "boletoDiasAposEntrega">, pedido: DataEntregaPedido, vencimento: Date, agora = new Date()) {
  if (regras.boletoDiasAposEntrega === null) return;
  const entrega = pedido.entregueEm ? diaNoFuso(pedido.entregueEm, pedido.fusoHorario) : pedido.previsaoData?.toISOString().slice(0, 10) ?? diaNoFuso(pedido.confirmadoEm ?? agora, pedido.fusoHorario);
  const limite = somarDias(entrega, regras.boletoDiasAposEntrega);
  // dataFinanceira constrói o vencimento como dia local ao meio-dia.
  const diaVencimento = `${vencimento.getFullYear()}-${String(vencimento.getMonth() + 1).padStart(2, "0")}-${String(vencimento.getDate()).padStart(2, "0")}`;
  if (diaVencimento > limite) throw new ErroPedidoVenda(`O boleto excede o prazo máximo de ${regras.boletoDiasAposEntrega} dias após a entrega permitido para este cliente.`);
}

/** Permite reduzir obrigações antigas mesmo se o limite cadastral tiver sido reduzido. */
export function exigirLimiteCreditoCliente(limite: Prisma.Decimal | null, saldoExistente: Prisma.Decimal, novoSaldoPedido: Prisma.Decimal, saldoAnteriorPedido = new Prisma.Decimal(0)) {
  if (limite === null || novoSaldoPedido.lte(saldoAnteriorPedido)) return;
  if (saldoExistente.minus(saldoAnteriorPedido).plus(novoSaldoPedido).gt(limite)) throw new ErroPedidoVenda("O pedido ultrapassa o limite total de crédito em aberto permitido para este cliente.");
}

/** O cliente deixa de dever a captura; o repasse pendente é obrigação do intermediador. */
export function saldoDevedorCliente(pendente: Prisma.Decimal, capturado: Prisma.Decimal, repassado: Prisma.Decimal) {
  return Prisma.Decimal.max(0, pendente.minus(capturado.minus(repassado)));
}
