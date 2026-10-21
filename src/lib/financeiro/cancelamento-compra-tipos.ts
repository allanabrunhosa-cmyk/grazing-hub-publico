export type ItemReversaoCompra = {
  id: string; descricao: string; quantidade: string; unidade: string;
  local: string; data: string; movimentoId: string;
};
export type ResumoCancelamentoCompra = {
  chaveOrigem: string; descricao: string; token: string; quantidadeLancamentos: number;
  valor: string; itens: ItemReversaoCompra[]; cancelada: boolean;
};
export type ConfirmacaoCancelamentoCompra = { token: string; motivo: string };
