import type { GrupoDre, StatusLancamento, TipoLancamento } from "@/generated/prisma/client";

export type CategoriaOption = { id: string; nome: string; grupo: GrupoDre };

export type ContaBancariaOption = { id: string; nome: string };

export type FornecedorOption = { id: string; nome: string };

export type FormaPagamentoOption = { id: string; nome: string };

export type LancamentoRow = {
  semClassificacao?: boolean;
  faturaId?: string;
  pagamentoFaturaId?: string;
  cartaoNome?: string;
  versao?: string;
  transacaoExtratoId?: string | null;
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  categoriaId: string;
  categoriaNome: string;
  categoriaGrupo: GrupoDre;
  dataCompetencia: string;
  dataVencimento: string;
  status: StatusLancamento;
  dataPagamento: string | null;
  pedidoQuitadoCredito?: boolean;
  pedidoVendaId?: string | null;
  contaBancariaId: string | null;
  contaBancariaNome: string | null;
  fornecedorId: string | null;
  fornecedorNome: string | null;
  formaPagamentoId: string | null;
  formaPagamentoNome: string | null;
  contraparteNome: string | null;
  observacoes: string | null;
  notaFiscal?: {
    id: string;
    numero: string;
    serie: string;
    fornecedorNome: string | null;
    parcela?: { id: string; numero: string; valor: number } | null;
  } | null;
  notaFiscalItemDescricao?: string | null;
};

export type LancamentoContaRow = LancamentoRow & { diasParaVencer: number };

export type ContaBancariaRow = {
  id: string;
  nome: string;
  saldoInicial: number;
  dataSaldoInicial: string | null;
  ativo: boolean;
  saldoAtual: number;
};

export type MovimentacaoBancariaRow = {
  id: string;
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  valor: number;
  data: string;
  descricao: string;
  contaBancariaNome: string;
  contaBancariaId?: string;
};

export type CategoriaFinanceiraRow = {
  paiId?: string | null;
  id: string;
  nome: string;
  grupo: GrupoDre;
  centroCustoId: string | null;
  centroCustoNome: string | null;
  ativo: boolean;
  excluidoEm: string | null;
  quantidadeLancamentos: number;
  quantidadeItensNota: number;
  quantidadeItensFatura: number;
  quantidadeRegrasCartao: number;
  quantidadeSubcategorias: number;
};
