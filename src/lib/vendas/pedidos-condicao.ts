import { ErroPedidoVenda } from "./pedidos-dominio";
import type { PagamentoComercialSnapshot } from "./pedidos-pagamento-comercial";
import type { CondicaoFinanceiraPedido } from "./pedidos";

function centavos(valor: string) {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(valor)) throw new ErroPedidoVenda("Informe valores em reais e centavos.");
  const [inteiros, fracao = ""] = valor.split(".");
  return BigInt(inteiros) * BigInt(100) + BigInt(fracao.padEnd(2, "0"));
}
function reais(valor: bigint) { return `${valor / BigInt(100)}.${String(valor % BigInt(100)).padStart(2, "0")}`; }

/** Parcelas de boleto dividem a obrigação; parcelas do cartão descrevem a captura,
 * não presumem calendário ou número de repasses da adquirente. */
export function condicaoDoPagamento({ total, credito = "0.00", pagamento, categoriaId, dataCompetencia, vencimento }: {
  total: string; credito?: string; pagamento: PagamentoComercialSnapshot | null;
  categoriaId: string; dataCompetencia: string; vencimento?: string;
}): CondicaoFinanceiraPedido {
  const saldo = centavos(total) - centavos(credito);
  if (saldo < BigInt(0)) throw new ErroPedidoVenda("Crédito usado excede o total do pedido.");
  if (saldo === BigInt(0)) return { categoriaId, dataCompetencia, creditoUtilizado: credito, parcelas: [] };
  if (!pagamento) throw new ErroPedidoVenda("Informe a forma de pagamento antes de confirmar.");
  const quantidade = pagamento.tipo === "BOLETO" ? pagamento.parcelas : 1;
  if (!Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 36 || saldo < BigInt(quantidade)) throw new ErroPedidoVenda("Valor insuficiente para as parcelas informadas.");
  const base = saldo / BigInt(quantidade), resto = saldo % BigInt(quantidade);
  return { categoriaId, dataCompetencia, creditoUtilizado: credito, parcelas: Array.from({ length: quantidade }, (_, i) => ({
    valor: reais(base + (BigInt(i) < resto ? BigInt(1) : BigInt(0))),
    vencimento: pagamento.tipo === "BOLETO" ? pagamento.vencimentos[i] : vencimento || dataCompetencia,
    formaPagamentoVendaId: pagamento.formaId,
    parcelasCliente: pagamento.tipo === "CARTAO_CREDITO" ? pagamento.parcelas : 1,
  })) };
}
