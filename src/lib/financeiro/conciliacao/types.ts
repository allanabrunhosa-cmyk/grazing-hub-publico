import type { LinhaArquivo, MapaCsv } from "./arquivo";
export type { MapaCsv };
export type PreviaExtrato = { nomeArquivo: string; referenciaOfx: string | null; contaNome: string; linhasSaldoIgnoradas: number; linhas: (LinhaArquivo & { situacao: "NOVA" | "EXISTENTE" | "POSSIVEL_DUPLICADA"; conciliada?: boolean; observacao?: string })[] };
export type ExtratoBancarioRow = { id: string; contaBancariaId: string; data: string; descricao: string; valor: number; identificador: string | null; arquivo: string; conciliadaEm: string | null; conciliadaPorNome: string | null; lancamentoIds: string[]; historico: { data: string; acao: string; autor: string; motivo: string | null }[] };
export type NovoLancamentoConciliacao = { descricao: string; categoriaId: string; dataCompetencia: string; dataVencimento: string; fornecedorId?: string; contraparteNome?: string; formaPagamentoId?: string; observacoes?: string };
export type EntradaConciliacao = { transacaoId: string; lancamentos?: { id: string; versao: string }[]; novo?: NovoLancamentoConciliacao };
export type AcessoConciliacao = {
  importar: boolean;
  conciliar: boolean;
  criar: boolean;
  baixar: boolean;
  desfazer: boolean;
  editarMovimentacao: boolean;
  excluirMovimentacao: boolean;
};
