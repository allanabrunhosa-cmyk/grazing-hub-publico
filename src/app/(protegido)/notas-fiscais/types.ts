import type { ComposicaoCusto } from "@/lib/notas-fiscais/custos";
import type {
  NotaFiscalRecebida,
  ManifestacaoNFe,
  TipoManifestacao,
  TipoDocumentoSefaz,
  StatusConciliacaoItem,
  DestinoItemNota,
  TratamentoLocalNotaFiscal,
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

export type NotaFiscalRow = Omit<NotaFiscalRecebida, "valorTotal" | "dataEmissao" | "createdAt" | "updatedAt" | "xml" | "xmlProximaTentativaEm" | "xmlTentativas" | "xmlUltimoMotivo" | "cienciaJaExistenteEm" | "tratamentoLocal" | "dataDevolucao" | "motivoTratamentoLocal" | "tratamentoLocalEm" | "tratamentoLocalVersao"> & {
  valorTotal: number | null;
  dataEmissao: string | null;
  createdAt: string;
  temXmlCompleto: boolean;
  tratamentoLocal?: TratamentoLocalNotaFiscal | null;
  dataDevolucao?: string | null;
  motivoTratamentoLocal?: string | null;
  tratamentoLocalEm?: string | null;
  tratamentoLocalVersao?: number;
  manifestacoes: ManifestacaoRow[];
};

// Categoria de negócio exibida pro usuário — agrupa os 4 tipos de manifestação (mais a
// ausência de manifestação) em algo mais direto do que a terminologia legal da SEFAZ.
export type CategoriaNota = "PENDENTE" | "AUTORIZADA" | "RECUSADA" | "OUTRA_OPERACAO" | "IGNORADA";

export const categoriaNotaLabels: Record<CategoriaNota, string> = {
  PENDENTE: "Pendente",
  AUTORIZADA: "Aceita",
  RECUSADA: "Recusada",
  OUTRA_OPERACAO: "Devolução/retorno",
  IGNORADA: "Ignorada",
};

export const CATEGORIA_BADGE_VARIANT: Record<CategoriaNota, "success" | "warning" | "destructive" | "secondary" | "muted"> = {
  PENDENTE: "warning",
  AUTORIZADA: "success",
  RECUSADA: "destructive",
  OUTRA_OPERACAO: "secondary",
  IGNORADA: "muted",
};

export function categoriaDaNota(ultimaManifestacao: TipoManifestacao | null, tratamentoLocal?: TratamentoLocalNotaFiscal | null): CategoriaNota {
  if (tratamentoLocal === "IGNORADA") return "IGNORADA";
  if (tratamentoLocal === "DEVOLUCAO_REGISTRADA") return "OUTRA_OPERACAO";
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
