import type { LancamentoRow } from "@/app/(protegido)/financeiro/types";

export function lancamentoTeste(dados: Partial<LancamentoRow> = {}): LancamentoRow {
  return {
    id: "aluguel", tipo: "DESPESA", descricao: "Aluguel da cozinha", valor: 800,
    categoriaId: "despesas", categoriaNome: "Ocupação", categoriaGrupo: "DESPESAS_OPERACIONAIS",
    dataCompetencia: "2026-09-01T12:00:00.000Z", dataVencimento: "2026-09-10T12:00:00.000Z",
    status: "PENDENTE", dataPagamento: null, contaBancariaId: null, contaBancariaNome: null,
    fornecedorId: null, fornecedorNome: null, formaPagamentoId: null, formaPagamentoNome: "Pix",
    contraparteNome: "Locador", observacoes: "Referente ao mês de setembro", ...dados,
  };
}
