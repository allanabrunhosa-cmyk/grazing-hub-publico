import type { SnapshotLayoutRtc } from "@/lib/tributacao/layout-rtc";

/** Contrato do documento calculado pelo motor servidor; não é cadastro comercial. */
export type DecimalBrasilNfe = string | number;
export type ProdutoBrasilNfe = {
  NmProduto: string;
  CodProdutoServico: string;
  NCM: string;
  /** A API gera cEAN e cEANTrib a partir de EAN para unidades fiscais iguais. */
  EAN: string;
  CEST?: string;
  OrigemProduto: number;
  /** Nome exato documentado em Produtos[].nFCI; nunca gerar o número localmente. */
  nFCI?: string;
  CFOP: number;
  UnidadeComercial: string;
  UnidadeComercialTributavel: string;
  Quantidade: DecimalBrasilNfe;
  QuantidadeTributavel: DecimalBrasilNfe;
  ValorUnitario: DecimalBrasilNfe;
  ValorUnitarioTributavel: DecimalBrasilNfe;
  ValorTotal: DecimalBrasilNfe;
  ValorDesconto?: DecimalBrasilNfe;
  ValorFrete?: DecimalBrasilNfe;
  ValorOutrasDespesas?: DecimalBrasilNfe;
  Imposto: {
    ICMS: { CodSituacaoTributaria: string; [campo: string]: unknown };
    PIS: { CodSituacaoTributaria: string; [campo: string]: unknown };
    COFINS: { CodSituacaoTributaria: string; [campo: string]: unknown };
    IBSCBS?: { CodClassificacaoTributaria: string; [campo: string]: unknown };
    [tributo: string]: unknown;
  };
  [campo: string]: unknown;
};
export type DocumentoBrasilNfe = {
  ModeloDocumento: 55 | 65;
  TipoAmbiente: 1 | 2;
  NaturezaOperacao: string;
  Finalidade: 1;
  IndicadorPresenca: 0 | 1 | 2 | 3 | 4 | 5 | 9;
  ConsumidorFinal: boolean;
  /** Informações complementares do documento: a API traduz para infAdic.infCpl. */
  Observacao?: string;
  /** Informação destinada ao Fisco: a API traduz para infAdic.infAdFisco. */
  ObservacaoFisco?: string;
  Produtos: ProdutoBrasilNfe[];
  Pagamentos: { FormaPagamento: string; VlPago: DecimalBrasilNfe; TipoIntegracao?: boolean; [campo: string]: unknown }[];
  Cliente?: { CpfCnpj: string; NmCliente: string; IndicadorIe: 1 | 2 | 9; Endereco?: Record<string, unknown>; [campo: string]: unknown };
  ValorTotal: DecimalBrasilNfe;
  [campo: string]: unknown;
};
export type SnapshotTributacaoBrasilNfe = {
  apto: boolean;
  pendencias: unknown[];
  emitenteCnpj: string;
  emitenteUf?: string;
  /** IE do perfil vigente fotografada pelo servidor; ausente somente em snapshots legados. */
  emitenteIE?: string;
  /** Confirmação explícita de pagamento externo sem integração para NFC-e/SP. */
  pagamentoCartaoNaoIntegrado?: true;
  crt: 0 | 1 | 2 | 3 | 4;
  documento: DocumentoBrasilNfe;
  previa?: { contexto: { data: string } };
  /** Decomposição servidor e caminhos da API comprovados no perfil vigente de 2027. */
  rtc2027?: SnapshotLayoutRtc;
};
export type ConfiguracaoBrasilNfe = {
  token: string;
  userToken: string;
  cnpj: string;
  ambiente: "HOMOLOGACAO" | "PRODUCAO";
  consultaIdentificadorValidada: boolean;
  homologacaoReferencia: string;
  producaoAutorizada: boolean;
};
