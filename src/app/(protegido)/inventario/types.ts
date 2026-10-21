import type { UnidadeMedida, MotivoPerda, StatusContagem, TipoMovimentacaoEstoque, TipoEstoque, TipoProdutoGlobal } from "@/generated/prisma/client";

export type LocalOption = { id: string; nome: string };

export type CategoriaOption = { id: string; nome: string };
export type CategoriaPerdaOption = { id: string; nome: string; ativo: boolean; codigoLegado: MotivoPerda | null; usada?: boolean };

export type InsumoOption = { id: string; nome: string; especificacao?: string | null; unidade: UnidadeMedida; custoMedio?: number };

export type InsumoParaContagemOption = { id: string; nome: string; especificacao?: string | null; descricao?: string | null; categoriaId: string | null };

export type PosicaoAtualRow = {
  insumoId: string;
  nome: string;
  tipo: TipoProdutoGlobal;
  marca: string | null;
  marcasHomologadas: string[];
  categoriaNome: string | null;
  fornecedoresHomologados: { id: string; nome: string }[];
  especificacao?: string | null;
  unidade: UnidadeMedida;
  estoqueMinimo: number;
  estoqueMaximo: number | null;
  custoMedio: number;
  // localId -> quantidade — a tabela decide se soma tudo ("Todos os locais") ou mostra
  // um local específico, sem precisar de nova consulta ao trocar o filtro.
  saldosPorLocal: Record<string, number>;
};

export type ContagemListRow = {
  id: string;
  localNome: string;
  dataContagem: string;
  status: StatusContagem;
  responsavelNome: string | null;
  totalItens: number;
  itensContados: number;
  itensAjustados: number;
};

// quantidadeSistema só vem preenchido quando a contagem já foi finalizada (inclusive cancelada depois) — enquanto
// EM_ANDAMENTO, essa fronteira já é aplicada no Server Component (ver contagem/[id]/page.tsx),
// não só escondida no client.
export type ContagemItemRow = {
  conversoes?: import("@/lib/insumos/conversoes").ConversaoInsumo[];
  id: string;
  insumoId: string;
  nome: string;
  especificacao?: string | null;
  unidade: UnidadeMedida;
  fornecedores: string[];
  marcas?: string[];
  tipoEstoque: TipoEstoque | null;
  estoqueMinimo: number;
  estoqueMaximo: number | null;
  contado: boolean;
  ajustado: boolean;
  quantidadeContada: number | null;
  quantidadeSistema: number | null;
};

export type ContagemDetalhe = {
  id: string;
  localNome: string;
  dataContagem: string;
  status: StatusContagem;
  itens: ContagemItemRow[];
  exclusao?: { data: string; autor: string; motivo: string | null; ajustesEstornados: boolean } | null;
};

export type PerdaRow = {
  id: string;
  data: string;
  insumoNome: string;
  insumoEspecificacao?: string | null;
  localNome: string;
  motivo: MotivoPerda;
  categoriaPerdaId?: string | null;
  categoriaNome?: string | null;
  motivoPersonalizado: string | null;
  quantidade: number;
  unidade: UnidadeMedida;
  valorEstimado: number;
  observacao: string | null;
  responsavelNome: string | null;
};

export type PerdaExcluidaRow = PerdaRow & {
  excluidaEm: string;
  motivoExclusao: string;
  responsavelExclusaoNome: string;
  quantidadeEstornada: number;
  unidadeEstornada: UnidadeMedida;
};

export type MovimentacaoRow = {
  id: string;
  createdAt: string;
  insumoNome: string;
  insumoEspecificacao?: string | null;
  unidade: UnidadeMedida;
  localNome: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number;
  saldo: number | null;
  observacao: string | null;
};

export type MovimentacaoInsumoDetalheRow = {
  id: string;
  createdAt: string;
  localNome: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number;
  saldo: number;
  observacao: string | null;
  responsavelNome: string | null;
};

export type HistoricoInsumoDetalhe = {
  insumoId: string;
  insumoNome: string;
  insumoEspecificacao?: string | null;
  unidade: UnidadeMedida;
  localNome: string | null;
  dataReferencia: string | null;
  saldoReferencia: number;
  saldoAnteriorAoTrecho: number;
  temMais: boolean;
  limite: number;
  movimentacoes: MovimentacaoInsumoDetalheRow[];
};
