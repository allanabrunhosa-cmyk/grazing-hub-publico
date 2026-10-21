import { ErroPedidoVenda, type PedidoEntrada } from "./pedidos-dominio";

type Forma = { id: string; nome: string; tipo: string; versao: number; ativo: boolean; permiteParcelamento: boolean; maximoParcelas: number };
export type PagamentoComercialSnapshot = NonNullable<PedidoEntrada["pagamentoInformado"]> & { nome: string; tipo: string; versao: number };
export function limiteParcelasComerciais(forma: Pick<Forma, "tipo" | "permiteParcelamento" | "maximoParcelas">) {
  if (!["CARTAO_CREDITO", "BOLETO"].includes(forma.tipo) || !forma.permiteParcelamento) return 1;
  return Math.min(forma.maximoParcelas, forma.tipo === "CARTAO_CREDITO" ? 4 : 120);
}
export function validarPagamentoComercial(entrada: NonNullable<PedidoEntrada["pagamentoInformado"]>, forma: Forma | null, confirmar = false): PagamentoComercialSnapshot {
  if (!forma?.ativo || forma.id !== entrada.formaId || !["PIX", "BOLETO", "CARTAO_CREDITO", "CARTAO_DEBITO"].includes(forma.tipo)) throw new ErroPedidoVenda("Selecione uma forma de pagamento ativa cadastrada em Vendas.");
  if (!Number.isSafeInteger(entrada.parcelas) || entrada.parcelas < 1) throw new ErroPedidoVenda("Parcelamento inválido.");
  if (entrada.parcelas > limiteParcelasComerciais(forma)) throw new ErroPedidoVenda("Parcelamento incompatível com a forma de pagamento cadastrada.");
  if (forma.tipo === "BOLETO") {
    if (entrada.vencimentos.length !== entrada.parcelas || confirmar && entrada.vencimentos.some(v => !v)) throw new ErroPedidoVenda("Informe o vencimento de cada parcela de boleto.");
  } else if (entrada.vencimentos.length) throw new ErroPedidoVenda("Vencimentos individuais são informados apenas para boleto.");
  return { ...entrada, nome: forma.nome, tipo: forma.tipo, versao: forma.versao };
}
