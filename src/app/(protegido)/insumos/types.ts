import type { ConservacaoEtiqueta, Insumo, TipoProdutoGlobal, UnidadeMedida } from "@/generated/prisma/client";
import type { ConversaoInsumo } from "@/lib/insumos/conversoes";
import type { PorcaoComposicao } from "@/lib/insumos/porcoes";

export type SimpleOption = { id: string; nome: string };

export type InsumoOption = { id: string; nome: string; especificacao?: string | null; tipo: TipoProdutoGlobal; unidade: UnidadeMedida; custoMedio?: number; custoUnitario?: number | null };

export type InsumoCriado = {
  id: string;
  nome: string;
  especificacao?: string | null;
  unidade: UnidadeMedida;
  custoMedio?: number;
  categoriaId: string | null;
  fornecedorPrincipalId: string | null;
  fornecedorIds: string[];
};

export type ComponenteRow = {
  componenteId: string;
  nome: string;
  especificacao?: string | null;
  categoriaNome?: string | null;
  tipo: TipoProdutoGlobal;
  unidade: UnidadeMedida;
  quantidade: number;
  /** Quantidade exata da porção recém-escolhida; não cria vínculo com o catálogo. */
  quantidadePorcao?: string;
  porcao?: PorcaoComposicao | null;
  custoUnitario?: number | null;
  observacaoPorcao: string | null;
  exibirFicha?: boolean;
};

// Decimal do Prisma não pode ir direto de Server pra Client Component — convertido pra number antes.
export type InsumoRow = Omit<
  Insumo,
  | "estoqueMinimo"
  | "especificacao"
  | "estoqueMaximo"
  | "custoMedio"
  | "rendimentoQuantidade"
  | "tempoPreparoMinutos"
  | "modoPreparo"
  | "fotoData"
  | "fotoMimeType"
  | "excluidoEm"
  | "excluidoPorId"
  | "exclusaoSnapshot"
  | "categoriaFinanceiraId"
  | "categoriaId"
  | "centroCustoId"
  | "marcasHomologadas"
  | "etiquetaHabilitada"
  | "validadeRefrigeradoDias"
  | "validadeCongeladoDias"
  | "validadeSecoDias"
  | "validadeAposAbertoDias"
  | "conservacaoEtiquetaPadrao"
  | "versaoConfiguracaoEtiqueta"
  | "etiquetaAtualizadaPorId"
> & {
  estoqueMinimo: number;
  especificacao?: string | null;
  estoqueMaximo: number | null;
  custoMedio?: number;
  custoUnitarioPreparacao?: number | null;
  motivoCustoPreparacao?: string | null;
  rendimentoQuantidade: number | null;
  tempoPreparoMinutos?: number | null;
  modoPreparo?: string[];
  temFoto: boolean;
  categoriaFinanceiraId?: string | null;
  categoriaFinanceira?: (SimpleOption & { grupo: import("@/generated/prisma/client").GrupoDre; ativo: boolean; excluidoEm: Date | null }) | null;
  categoria: SimpleOption | null;
  centroCusto: SimpleOption | null;
  fornecedorPrincipal: { nome: string } | null;
  fornecedoresHomologados: FornecedorOption[];
  componentes: ComponenteRow[];
  conversoes?: ConversaoInsumo[];
  marcasHomologadas?: string[];
  etiquetaHabilitada?: boolean;
  validadeSecoDias?: number | null;
  validadeRefrigeradoDias?: number | null;
  validadeCongeladoDias?: number | null;
  validadeAposAbertoDias?: number | null;
  conservacaoEtiquetaPadrao?: ConservacaoEtiqueta | null;
};

export type FornecedorOption = { id: string; nome: string };
