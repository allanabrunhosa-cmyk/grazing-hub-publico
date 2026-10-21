import type { Prisma } from "@/generated/prisma/client";
import { dataCalendarioValida, vencimentoCartao } from "@/lib/financeiro/cartoes";

export type PagamentoNota = {
  formaPagamento?: "BOLETO" | "PIX" | "CARTAO"; cartaoCreditoId?: string | null;
  dataCompra?: string | null; parcelaCartao?: number;
};

export async function prepararPagamento(tx: Prisma.TransactionClient, parcela: PagamentoNota & { dataVencimento: string }) {
  const formaPagamento = parcela.formaPagamento ?? "BOLETO";
  if (!["BOLETO", "PIX", "CARTAO"].includes(formaPagamento) || !dataCalendarioValida(parcela.dataVencimento)) throw new Error("Informe forma de pagamento e vencimento válidos.");
  const base = { formaPagamento, cartaoCreditoId: null as string | null, dataCompra: null as Date | null, parcelaCartao: 1, dataVencimento: new Date(parcela.dataVencimento + "T12:00:00Z"), contaBancariaId: null as string | null };
  if (formaPagamento !== "CARTAO") return base;
  if (!parcela.cartaoCreditoId || !parcela.dataCompra) throw new Error("Selecione o cartão e a data da compra.");
  const cartao = await tx.cartaoCredito.findUnique({ where: { id: parcela.cartaoCreditoId }, include: { contaBancaria: true } });
  if (!cartao?.ativo || !cartao.contaBancaria.ativo) throw new Error("Selecione um cartão ativo vinculado a uma conta ativa.");
  const numero = parcela.parcelaCartao ?? 1;
  const vencimento = vencimentoCartao(parcela.dataCompra, cartao.diaFechamento, cartao.diaVencimento, numero);
  if (vencimento !== parcela.dataVencimento) throw new Error("A configuração do cartão mudou ou o vencimento não corresponde à fatura. Reabra a nota e confira a parcela.");
  return { ...base, cartaoCreditoId: cartao.id, contaBancariaId: cartao.contaBancariaId, dataCompra: new Date(parcela.dataCompra + "T12:00:00Z"), parcelaCartao: numero };
}

export function pagamentoIgual(atual: { formaPagamento?: string; cartaoCreditoId?: string | null; dataCompra?: Date | null; parcelaCartao?: number }, entrada: PagamentoNota) {
  return (atual.formaPagamento ?? "BOLETO") === (entrada.formaPagamento ?? "BOLETO")
    && (atual.cartaoCreditoId ?? null) === (entrada.formaPagamento === "CARTAO" ? entrada.cartaoCreditoId ?? null : null)
    && (atual.dataCompra?.toISOString().slice(0, 10) ?? null) === (entrada.formaPagamento === "CARTAO" ? entrada.dataCompra ?? null : null)
    && (atual.parcelaCartao ?? 1) === (entrada.formaPagamento === "CARTAO" ? entrada.parcelaCartao ?? 1 : 1);
}
