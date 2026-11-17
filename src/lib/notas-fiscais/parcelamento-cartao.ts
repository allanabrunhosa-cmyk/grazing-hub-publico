import { dataCalendarioValida, vencimentoCartao, type CartaoOption } from "@/lib/financeiro/cartoes";
import type { PagamentoNota } from "./pagamentos";

type Parcela = PagamentoNota & {
  id?: string; numero: string; valor: string; dataVencimento: string; bloqueada?: boolean;
};

/** Divide o valor informado, sem reinterpretar o ordinal salvo em parcelaCartao. */
export function dividirParcelaCartao(parcelas: Parcela[], indice: number, quantidade: number, cartoes: CartaoOption[]): Parcela[] {
  const atual = parcelas[indice];
  if (!atual || atual.bloqueada || atual.formaPagamento !== "CARTAO") throw new Error("Selecione uma parcela de cartão disponível para edição.");
  if (!Number.isInteger(quantidade) || quantidade < 2 || quantidade > 120) throw new Error("Informe de 2 a 120 parcelas.");
  if (parcelas.length + quantidade - 1 > 120) throw new Error("A nota admite até 120 parcelas. Reduza a quantidade para dividir.");
  const valor = atual.valor.trim().replace(",", ".");
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(valor)) throw new Error("Informe um valor válido, com até duas casas decimais.");
  const [inteiros, fracao = ""] = valor.split(".");
  const total = Number(inteiros) * 100 + Number(fracao.padEnd(2, "0"));
  if (!Number.isSafeInteger(total) || total < quantidade) throw new Error("O valor deve permitir ao menos R$ 0,01 por parcela.");
  const cartao = cartoes.find(c => c.id === atual.cartaoCreditoId && c.ativo);
  if (!cartao || !dataCalendarioValida(atual.dataCompra ?? "")) throw new Error("Selecione o cartão e informe a data da compra antes de dividir.");
  const numeros = new Set(parcelas.map(p => p.numero));
  let proximo = 1;
  const novas = Array.from({ length: quantidade }, (_, i): Parcela => {
    let numero = atual.numero;
    if (i > 0) {
      while (numeros.has(String(proximo).padStart(3, "0"))) proximo++;
      numero = String(proximo++).padStart(3, "0");
      numeros.add(numero);
    }
    const centavos = Math.floor(total / quantidade) + (i < total % quantidade ? 1 : 0);
    return {
      ...atual, id: i === 0 ? atual.id : undefined, numero,
      valor: `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`,
      parcelaCartao: i + 1,
      dataVencimento: vencimentoCartao(atual.dataCompra!, cartao.diaFechamento, cartao.diaVencimento, i + 1),
    };
  });
  return [...parcelas.slice(0, indice), ...novas, ...parcelas.slice(indice + 1)];
}
