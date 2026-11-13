import { dataCalendarioValida, vencimentoCartao } from "@/lib/financeiro/cartoes";
import { DecimalEstoque } from "@/lib/estoque/quantidade";

export type PagamentoEntradaInput = {
  formaPagamento: "BOLETO" | "PIX" | "CARTAO";
  cartaoCreditoId?: string | null;
  dataCompra?: string | null;
  parcelaCartao?: number;
  parcelas: { valor: number; dataVencimento: string }[];
};

export class ErroPagamentoEntrada extends Error {}

export function normalizarPagamentoEntrada(pagamento: PagamentoEntradaInput): PagamentoEntradaInput {
  const cartao = pagamento.formaPagamento === "CARTAO";
  return {
    formaPagamento: pagamento.formaPagamento,
    cartaoCreditoId: cartao ? pagamento.cartaoCreditoId ?? null : null,
    dataCompra: cartao ? pagamento.dataCompra ?? null : null,
    parcelaCartao: cartao ? pagamento.parcelaCartao ?? 1 : 1,
    parcelas: pagamento.parcelas.map(p => ({ valor: p.valor, dataVencimento: p.dataVencimento }))
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || a.valor - b.valor),
  };
}

export function validarPagamentoEntrada(pagamento: PagamentoEntradaInput, valorTotal: number): PagamentoEntradaInput {
  if (!pagamento || !["BOLETO", "PIX", "CARTAO"].includes(pagamento.formaPagamento)) throw new ErroPagamentoEntrada("Informe uma forma de pagamento válida.");
  if (!Array.isArray(pagamento.parcelas) || pagamento.parcelas.length < 1 || pagamento.parcelas.length > 36) throw new ErroPagamentoEntrada("Informe de 1 a 36 parcelas.");
  for (const parcela of pagamento.parcelas) {
    if (!parcela || !Number.isFinite(parcela.valor) || parcela.valor <= 0 || parcela.valor >= 1e10 || new DecimalEstoque(parcela.valor).decimalPlaces() > 2) throw new ErroPagamentoEntrada("Informe parcelas positivas com até duas casas decimais.");
    if (typeof parcela.dataVencimento !== "string" || !dataCalendarioValida(parcela.dataVencimento)) throw new ErroPagamentoEntrada("Informe um vencimento válido em todas as parcelas.");
  }
  if (!Number.isFinite(valorTotal) || !pagamento.parcelas.reduce((s, p) => s.plus(p.valor), new DecimalEstoque(0)).equals(valorTotal)) throw new ErroPagamentoEntrada("A soma das parcelas deve ser igual ao total da compra.");
  if (pagamento.formaPagamento === "CARTAO" && (typeof pagamento.cartaoCreditoId !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(pagamento.cartaoCreditoId)
    || typeof pagamento.dataCompra !== "string" || !dataCalendarioValida(pagamento.dataCompra) || !Number.isInteger(pagamento.parcelaCartao ?? 1)
    || (pagamento.parcelaCartao ?? 1) < 1 || (pagamento.parcelaCartao ?? 1) + pagamento.parcelas.length - 1 > 120)) throw new ErroPagamentoEntrada("Selecione o cartão, a data da compra e uma parcela inicial válida.");
  return normalizarPagamentoEntrada(pagamento);
}

export function pagamentosEntradaIguais(a: PagamentoEntradaInput, b: PagamentoEntradaInput) {
  return JSON.stringify(normalizarPagamentoEntrada(a)) === JSON.stringify(normalizarPagamentoEntrada(b));
}

/** Gera um rascunho em centavos. A validação da submissão exige parcelas positivas. */
export function gerarParcelasEntrada(input: {
  valorTotal: number; quantidade: number; dataVencimento: string;
  formaPagamento: PagamentoEntradaInput["formaPagamento"];
  cartao?: { diaFechamento: number; diaVencimento: number };
  dataCompra?: string | null; parcelaCartao?: number;
}): PagamentoEntradaInput["parcelas"] {
  if (!Number.isInteger(input.quantidade) || input.quantidade < 1 || input.quantidade > 36) throw new ErroPagamentoEntrada("Informe de 1 a 36 parcelas.");
  const total = new DecimalEstoque(input.valorTotal);
  if (!total.isFinite() || total.lt(0) || total.gte(1e10) || total.decimalPlaces() > 2) throw new ErroPagamentoEntrada("Informe um total válido com até duas casas decimais.");
  if (!dataCalendarioValida(input.dataVencimento)) throw new ErroPagamentoEntrada("Informe um vencimento válido.");
  const centavos = total.times(100).toNumber();
  const base = Math.floor(centavos / input.quantidade);
  const resto = centavos % input.quantidade;
  const [ano, mes, dia] = input.dataVencimento.split("-").map(Number);
  return Array.from({ length: input.quantidade }, (_, indice) => {
    let dataVencimento: string;
    if (input.formaPagamento === "CARTAO") {
      if (!input.cartao || !input.dataCompra) throw new ErroPagamentoEntrada("Selecione o cartão e a data da compra.");
      dataVencimento = vencimentoCartao(input.dataCompra, input.cartao.diaFechamento, input.cartao.diaVencimento, (input.parcelaCartao ?? 1) + indice);
    } else {
      const ultimoDia = new Date(Date.UTC(ano, mes + indice, 0)).getUTCDate();
      dataVencimento = new Date(Date.UTC(ano, mes - 1 + indice, Math.min(dia, ultimoDia), 12)).toISOString().slice(0, 10);
    }
    if (!dataCalendarioValida(dataVencimento)) throw new ErroPagamentoEntrada("As parcelas ultrapassam o intervalo de datas permitido.");
    return { valor: (base + (indice < resto ? 1 : 0)) / 100, dataVencimento };
  });
}
