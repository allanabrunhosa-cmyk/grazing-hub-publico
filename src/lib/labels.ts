import type {
  TipoProdutoGlobal,
  UnidadeMedida,
  TipoEstoque,
  TipoMovimentacaoEstoque,
  MotivoPerda,
  StatusContagem,
  TipoDivergencia,
  GrupoDre,
  TipoLancamento,
  StatusLancamento,
  TipoMovimentacaoBancaria,
} from "@/generated/prisma/client";

export const tipoProdutoGlobalLabels: Record<TipoProdutoGlobal, string> = {
  INSUMO: "Insumo",
  PRODUTO_INTERMEDIARIO: "Preparação",
};

export const unidadeMedidaLabels: Record<UnidadeMedida, string> = {
  KG: "Quilograma (kg)",
  G: "Grama (g)",
  L: "Litro (L)",
  ML: "Mililitro (ml)",
  UN: "Unidade (un)",
  CX: "Caixa (cx)",
  PCT: "Pacote (pct)",
  FD: "Fardo (fd)",
  DZ: "Dúzia (dz)",
  ROLO: "Rolo",
  MACO: "Maço",
  CACHO: "Cacho",
  PORCAO: "Porção",
  METADE: "Metade",
  BALDE: "Balde",
  GALAO: "Galão",
  PECA: "Peça",
  BAG: "Bag",
  GARRAFA: "Garrafa",
  LATA: "Lata",
};

export const unidadeMedidaAbreviada: Record<UnidadeMedida, string> = {
  KG: "kg",
  G: "g",
  L: "L",
  ML: "ml",
  UN: "un",
  CX: "cx",
  PCT: "pct",
  FD: "fd",
  DZ: "dz",
  ROLO: "rolo",
  MACO: "maço",
  CACHO: "cacho",
  PORCAO: "porção",
  METADE: "metade",
  BALDE: "balde",
  GALAO: "galão",
  PECA: "peça",
  BAG: "bag",
  GARRAFA: "garrafa",
  LATA: "lata",
};

export const tipoEstoqueLabels: Record<TipoEstoque, string> = {
  SECO: "Ambiente",
  REFRIGERADO: "Refrigerado",
  CONGELADO: "Congelado",
};

export const tipoMovimentacaoEstoqueLabels: Record<TipoMovimentacaoEstoque, string> = {
  ENTRADA_COMPRA: "Entrada (compra)",
  SAIDA_CONSUMO: "Saída (consumo)",
  SAIDA_PERDA: "Saída (perda)",
  AJUSTE_ENTRADA: "Ajuste (entrada)",
  AJUSTE_SAIDA: "Ajuste (saída)",
};

export const motivoPerdaLabels: Record<MotivoPerda, string> = {
  VALIDADE_VENCIDA: "Validade vencida",
  QUEBRA: "Quebra",
  ERRO_PRODUCAO: "Erro de produção",
  FURTO: "Furto",
  OUTRO: "Outro",
};

export const statusContagemLabels: Record<StatusContagem, string> = {
  EM_ANDAMENTO: "Em andamento",
  FINALIZADO: "Finalizado",
  EXCLUIDO: "Excluída",
};

export const tipoDivergenciaLabels: Record<TipoDivergencia, string> = {
  FALTOU: "faltou",
  VEIO_ERRADO: "não estava no pedido",
  FORA_DO_PRAZO: "fora do prazo",
  QUALIDADE: "problema de qualidade",
};

// Ordem em que os grupos aparecem no waterfall do DRE e no Plano de Contas —
// use esta ordem (Object.keys/entries de grupoDreLabels não garante ordem de enum).
export const ORDEM_GRUPOS_DRE: GrupoDre[] = [
  "RECEITA_BRUTA",
  "DEDUCOES_RECEITA",
  "CMV",
  "DESPESAS_VARIAVEIS",
  "FOLHA_PAGAMENTO",
  "DESPESAS_OPERACIONAIS",
  "INVESTIMENTOS",
  "DESPESAS_FINANCEIRAS",
  "RECEITAS_NAO_OPERACIONAIS",
  "DEPRECIACAO_AMORTIZACAO",
  "DESPESAS_NAO_OPERACIONAIS",
];

export const grupoDreLabels: Record<GrupoDre, string> = {
  RECEITA_BRUTA: "Receita Bruta",
  DEDUCOES_RECEITA: "Deduções de Receita",
  CMV: "CMV — Custo da Mercadoria",
  DESPESAS_VARIAVEIS: "Despesas Variáveis",
  FOLHA_PAGAMENTO: "Despesas com pessoal",
  DESPESAS_OPERACIONAIS: "Despesas Operacionais",
  INVESTIMENTOS: "Investimentos",
  DESPESAS_FINANCEIRAS: "Despesas Financeiras",
  DEPRECIACAO_AMORTIZACAO: "Depreciação e Amortização",
  RECEITAS_NAO_OPERACIONAIS: "Receitas financeiras",
  DESPESAS_NAO_OPERACIONAIS: "Despesas Não Operacionais",
};

// Grupos que compõem receita — usados pra filtrar a Categoria disponível conforme o
// tipo de Lançamento escolhido (Receita só pode usar categoria de grupo de receita).
export const GRUPOS_RECEITA: GrupoDre[] = ["RECEITA_BRUTA", "RECEITAS_NAO_OPERACIONAIS"];

export const tipoLancamentoLabels: Record<TipoLancamento, string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
};

export const statusLancamentoLabels: Record<StatusLancamento, string> = {
  PENDENTE: "Pendente",
  BAIXADO: "Baixado",
  CANCELADO: "Excluído",
};

export const tipoMovimentacaoBancariaLabels: Record<TipoMovimentacaoBancaria, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE: "Ajuste",
};
