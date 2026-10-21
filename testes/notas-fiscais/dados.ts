import type { NotaFiscalRow, ItemConciliacaoRow } from "@/app/(protegido)/notas-fiscais/types";

export const notaTeste: NotaFiscalRow = {
  id: "nota-teste", chaveAcesso: "0".repeat(44), nsu: "000000000000001", tipo: "PROC_NFE",
  fornecedorNome: "Fornecedor de teste", fornecedorCnpj: "00000000000000", valorTotal: 100,
  dataEmissao: "2026-09-10T12:00:00.000Z", createdAt: "2026-09-10T12:00:00.000Z",
  ultimaManifestacao: null, temXmlCompleto: true, manifestacoes: [],
};

export const itemTeste: ItemConciliacaoRow = {
  id: "item-teste", numeroItem: 1, codigoProdutoFornecedor: "001", descricaoProduto: "Queijo de teste",
  codigoEan: null, ncm: "04069090", unidadeComercial: "KG", quantidadeComercial: 2, valorTotalItem: 100,
  status: "PENDENTE", destino: "ESTOQUE", insumoId: "insumo-teste", insumoNome: "Queijo de teste",
  categoriaFinanceiraId: null, categoriaFinanceiraNome: null, quantidadeConciliada: null, valorTotalConciliado: null,
};

export const detalhesTeste = {
  itens: [itemTeste], detalhes: null,
  duplicatas: [{ id: "duplicata-teste", numero: "001", dataVencimento: "2026-10-10", valor: 100 }],
};

export const opcoesTeste = {
  locais: [{ id: "local-teste", nome: "Estoque de teste" }],
  insumos: [{ id: "insumo-teste", nome: "Queijo de teste", unidade: "KG" as const, custoMedio: 50 }],
  categoriasInsumo: [], centrosCustoInsumo: [], fornecedoresInsumo: [], todosInsumosCadastro: [], categoriasFinanceiras: [],
};
