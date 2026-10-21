import { dataLancamentoValida } from "./data-lancamento";
export type CartaoOption = {
  id: string; nome: string; contaBancariaId: string; contaBancariaNome: string;
  diaFechamento: number; diaVencimento: number; ativo: boolean;
  emissor?:string|null; bandeira?:string|null; final?:string|null; limite?:string|null;
  observacoes?:string|null; responsavelId?:string|null; toleranciaDias?:number; updatedAt?:string;
};

export function dataCalendarioValida(data: string): boolean {
  return dataLancamentoValida(data);
}

function dataDoMes(ano: number, mes: number, dia: number) {
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimo), 12));
}

// O dia de fechamento já pertence à próxima fatura. Dias inexistentes usam o último dia do mês.
export function vencimentoCartao(dataCompra: string, fechamento: number, vencimento: number, parcela = 1): string {
  if (!dataCalendarioValida(dataCompra) || ![fechamento, vencimento].every(d => Number.isInteger(d) && d >= 1 && d <= 31)
    || !Number.isInteger(parcela) || parcela < 1 || parcela > 120) throw new Error("Confira a data da compra e os dias de fechamento e vencimento do cartão.");
  const compra = new Date(dataCompra + "T12:00:00Z");
  let mes = compra.getUTCMonth();
  const ano = compra.getUTCFullYear();
  if (compra >= dataDoMes(ano, mes, fechamento)) mes++;
  const fecha = dataDoMes(ano, mes, fechamento);
  if (dataDoMes(ano, mes, vencimento) <= fecha) mes++;
  return dataDoMes(ano, mes + parcela - 1, vencimento).toISOString().slice(0, 10);
}
