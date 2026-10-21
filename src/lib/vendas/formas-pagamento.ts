/** Condições comerciais de recebimento; não criam lançamentos financeiros. */
import { ErroCadastroVenda, objeto, texto, inteiro } from "./dominio";

export const TIPOS_FORMA_PAGAMENTO = {
  BOLETO: "Boleto",
  PIX: "Pix",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  VOUCHER: "Voucher",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
} as const;
export type TipoFormaPagamentoVenda = keyof typeof TIPOS_FORMA_PAGAMENTO;
export type FaixaTaxaVenda = { de: number; ate: number; percentual: string; fixa: string };
export type FormaPagamentoVendaEntrada = {
  id: string; versao: number; nome: string; tipo: TipoFormaPagamentoVenda;
  taxaPercentual: string; taxaFixa: string;
  prazoDias: number; inicioPrazo: "VENDA" | "PAGAMENTO"; contagemPrazo: "CORRIDOS" | "UTEIS";
  vencimentoFlexivel: boolean; permiteParcelamento: boolean; maximoParcelas: number;
  faixasTaxa: FaixaTaxaVenda[]; observacoes: string | null; ativo: boolean;
};

function taxa(valor: unknown, campo: string, casas: number, maximo: number): string {
  if (typeof valor !== "string" && typeof valor !== "number") throw new ErroCadastroVenda(`${campo}: informe um valor válido.`);
  const entrada = String(valor).trim().replace(",", ".");
  if (!new RegExp(`^\\d{1,10}(\\.\\d{1,${casas}})?$`).test(entrada) || Number(entrada) > maximo) {
    throw new ErroCadastroVenda(`${campo}: informe um valor de 0 a ${maximo} com até ${casas} casas decimais.`);
  }
  return Number(entrada).toFixed(casas);
}

export function validarFormaPagamentoVenda(entrada: unknown): FormaPagamentoVendaEntrada {
  const d = objeto(entrada);
  const id = texto(d.id, "Identificador", 100);
  const versao = inteiro(d.versao ?? 0, "Versão");
  const nome = texto(d.nome, "Nome", 120, true);
  if (!(typeof d.tipo === "string" && d.tipo in TIPOS_FORMA_PAGAMENTO)) throw new ErroCadastroVenda("Escolha um tipo de pagamento válido.");
  const tipo = d.tipo as TipoFormaPagamentoVenda;
  const taxaPercentual = taxa(d.taxaPercentual, "Taxa percentual", 2, 100);
  const taxaFixa = taxa(d.taxaFixa, "Taxa fixa", 2, 9999999999);
  const prazoDias = inteiro(d.prazoDias, "Prazo");
  if (prazoDias > 3650) throw new ErroCadastroVenda("Prazo: informe no máximo 3650 dias.");
  if (d.inicioPrazo !== "VENDA" && d.inicioPrazo !== "PAGAMENTO") throw new ErroCadastroVenda("Escolha quando começa o prazo.");
  if (d.contagemPrazo !== "CORRIDOS" && d.contagemPrazo !== "UTEIS") throw new ErroCadastroVenda("Escolha a contagem dos dias.");
  if (typeof d.vencimentoFlexivel !== "boolean" || typeof d.permiteParcelamento !== "boolean" || typeof d.ativo !== "boolean") throw new ErroCadastroVenda("Confira as opções de pagamento.");
  if (d.vencimentoFlexivel && prazoDias === 0) throw new ErroCadastroVenda("Defina um prazo maior que zero para permitir escolher o vencimento.");
  const permiteParcelamento = d.permiteParcelamento;
  const maximoParcelas = inteiro(d.maximoParcelas, "Máximo de parcelas");
  if (maximoParcelas < 1 || maximoParcelas > 120 || (!permiteParcelamento && maximoParcelas !== 1) || (permiteParcelamento && maximoParcelas < 2)) throw new ErroCadastroVenda("O parcelamento deve permitir de 2 a 120 parcelas.");
  if (!Array.isArray(d.faixasTaxa) || d.faixasTaxa.length > 30) throw new ErroCadastroVenda("Informe até 30 faixas de taxas extras.");
  if (!permiteParcelamento && d.faixasTaxa.length) throw new ErroCadastroVenda("Taxas por parcela exigem parcelamento habilitado.");
  const faixasTaxa = d.faixasTaxa.map((valor, indice) => {
    const f = objeto(valor);
    const de = inteiro(f.de, `Início da faixa ${indice + 1}`);
    const ate = inteiro(f.ate, `Fim da faixa ${indice + 1}`);
    if (de < 1 || ate < de || ate > maximoParcelas) throw new ErroCadastroVenda(`Faixa ${indice + 1}: escolha parcelas de 1 a ${maximoParcelas}, com início até o fim.`);
    const percentual = taxa(f.percentual, `Taxa extra percentual da faixa ${indice + 1}`, 2, 100);
    const fixa = taxa(f.fixa, `Taxa extra fixa da faixa ${indice + 1}`, 2, 9999999999);
    if (Math.round(Number(taxaPercentual) * 100) + Math.round(Number(percentual) * 100) > 10000) throw new ErroCadastroVenda(`Faixa ${indice + 1}: a taxa percentual total não pode ultrapassar 100%.`);
    return { de, ate, percentual, fixa };
  }).sort((a, b) => a.de - b.de);
  for (let i = 1; i < faixasTaxa.length; i++) if (faixasTaxa[i].de <= faixasTaxa[i - 1].ate) throw new ErroCadastroVenda("As faixas de parcelas não podem se sobrepor.");
  return { id, versao, nome, tipo, taxaPercentual, taxaFixa, prazoDias,
    inicioPrazo: d.inicioPrazo, contagemPrazo: d.contagemPrazo,
    vencimentoFlexivel: d.vencimentoFlexivel, permiteParcelamento, maximoParcelas,
    faixasTaxa, observacoes: texto(d.observacoes, "Observações", 1000) || null, ativo: d.ativo };
}

export function taxasNaParcela(forma: Pick<FormaPagamentoVendaEntrada, "taxaPercentual" | "taxaFixa" | "faixasTaxa">, parcelas: number) {
  const extra = forma.faixasTaxa.find(f => parcelas >= f.de && parcelas <= f.ate);
  return {
    percentual: (Math.round(Number(forma.taxaPercentual) * 100) + Math.round(Number(extra?.percentual ?? 0) * 100)) / 100,
    fixa: (Math.round(Number(forma.taxaFixa) * 100) + Math.round(Number(extra?.fixa ?? 0) * 100)) / 100,
  };
}
