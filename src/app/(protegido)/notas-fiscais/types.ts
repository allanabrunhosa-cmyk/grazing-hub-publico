import type { ComposicaoCusto } from "@/lib/notas-fiscais/custos";
import type {
  NotaFiscalRecebida,
  ManifestacaoNFe,
  TipoManifestacao,
  TipoDocumentoSefaz,
  StatusConciliacaoItem,
  DestinoItemNota,
} from "@/generated/prisma/client";

export type { TipoManifestacao, TipoDocumentoSefaz, StatusConciliacaoItem, DestinoItemNota };

export type LocalOption = { id: string; nome: string };

export type ItemConciliacaoRow = {
  fatorConversao?: number | null;
  id: string;
  numeroItem: number;
  codigoProdutoFornecedor: string;
  descricaoProduto: string;
  codigoEan: string | null;
  ncm: string | null;
  unidadeComercial: string;
  quantidadeComercial: number;
  unidadeTributavel?: string | null;
  quantidadeTributavel?: number | null;
  valorUnitarioComercial?: number | null;
  valorTotalItem: number;
  status: StatusConciliacaoItem;
  destino: DestinoItemNota;
  insumoId: string | null;
  insumoNome: string | null;
  insumoEspecificacao?: string | null;
  categoriaFinanceiraId: string | null;
  categoriaFinanceiraNome: string | null;
  quantidadeConciliada: number | null;
  dataEntradaEstoque?: string | null;
  valorTotalConciliado: number | null;
  composicaoCusto?: ComposicaoCusto | null;
};

export type DuplicataRow = import("@/lib/notas-fiscais/pagamentos").PagamentoNota & {
  bloqueada?: boolean;
  id: string;
  numero: string;
  dataVencimento: string;
  valor: number;
};

export type EmitenteEnderecoRow = {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
};

export type DetalhesFiscaisRow = {
  naturezaOperacao: string | null;
  modelo: string | null;
  serie: string | null;
  numero: string | null;
  codigoUnico: string | null;
  versao: string | null;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  emitenteEndereco: EmitenteEnderecoRow;
  fornecedorCadastrado: { id: string; nome: string; memorizado?: boolean } | null;
};

export type ManifestacaoRow = Omit<ManifestacaoNFe, "createdAt"> & { createdAt: string };

export type NotaFiscalRow = Omit<NotaFiscalRecebida, "valorTotal" | "dataEmissao" | "createdAt" | "updatedAt" | "xml" | "xmlProximaTentativaEm" | "xmlTentativas" | "xmlUltimoMotivo" | "cienciaJaExistenteEm"> & {
  valorTotal: number | null;
  dataEmissao: string | null;
  createdAt: string;
  temXmlCompleto: boolean;
  manifestacoes: ManifestacaoRow[];
};

// Categoria de negócio exibida pro usuário — agrupa os 4 tipos de manifestação (mais a
// ausência de manifestação) em algo mais direto do que a terminologia legal da SEFAZ.
export type CategoriaNota = "PENDENTE" | "AUTORIZADA" | "RECUSADA";

export const categoriaNotaLabels: Record<CategoriaNota, string> = {
  PENDENTE: "Pendente",
  AUTORIZADA: "Aceita",
  RECUSADA: "Recusada",
};

export const CATEGORIA_BADGE_VARIANT: Record<CategoriaNota, "success" | "warning" | "destructive"> = {
  PENDENTE: "warning",
  AUTORIZADA: "success",
  RECUSADA: "destructive",
};

export function categoriaDaNota(ultimaManifestacao: TipoManifestacao | null): CategoriaNota {
  switch (ultimaManifestacao) {
    case "CONFIRMACAO_DA_OPERACAO":
      return "AUTORIZADA";
    case "DESCONHECIMENTO_DA_OPERACAO":
    case "OPERACAO_NAO_REALIZADA":
      return "RECUSADA";
    default:
      return "PENDENTE";
  }
}
