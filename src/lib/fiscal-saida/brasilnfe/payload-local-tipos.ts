import type { ModeloDocumentoBrasilNfe } from "./mapeamento";

/** Valores exatos em memória. O serializador dedicado emite tokens JSON numéricos. */
export type DecimalFiscalLocal = string;
export type EnderecoFiscalLocal = {
  cep: string; logradouro: string; numero: string; complemento?: string;
  bairro: string; cidade: string; uf: string; codMunicipio: string; codPais: number; pais: string;
};
export type EnderecoPayloadBrasilNfe = {
  Cep: string; Logradouro: string; Numero: string; Complemento?: string;
  Bairro: string; Municipio: string; Uf: string; CodMunicipio: string; CodPais: number; Pais: string;
};
export type TributoAliquotaLocal = { BaseCalculo: DecimalFiscalLocal; Aliquota: DecimalFiscalLocal };
export type IcmsLocal =
  | { tratamento: "SEM_DESTAQUE" }
  | { tratamento: "TRIBUTADO"; BaseCalculo: DecimalFiscalLocal; AliquotaICMS: DecimalFiscalLocal; modalidadeBcIcms: 0 | 1 | 2 | 3 };
export type RegraItemFiscalLocal = {
  itemId: string; produtoId: string; versaoCadastro: number;
  referenciaFundamentacao?: string;
  /** Compatibilidade de leitura do complemento legado; não aprova nova regra. */
  referenciaConfirp?: string;
  cestAplicavel: boolean; fatorTributavel: DecimalFiscalLocal;
  icms: IcmsLocal;
  /** DAS é tratamento explicitamente revisado; não equivale a isenção ou alíquota fiscal presumida. */
  pis: { tratamento: "SEM_DESTAQUE" | "RECOLHIDO_DAS" } | ({ tratamento: "TRIBUTADO" } & TributoAliquotaLocal);
  cofins: { tratamento: "SEM_DESTAQUE" | "RECOLHIDO_DAS" } | ({ tratamento: "TRIBUTADO" } & TributoAliquotaLocal);
  /** Recorte inicial de venda normal. Aplicabilidade não pode ser presumida por ausência. */
  ipiAplicavel: boolean | null; stAplicavel: boolean; fcpAplicavel: boolean;
  /** Decisão sobre representação no documento, independente do Anexo do DAS.
   * Ausência conserva o contrato legado; jamais presume omissão por CRT. */
  representacaoIpi?: "OMITIR_SIMPLES";
  difalAplicavel: boolean; ibsCbsAplicavel: boolean; beneficioFiscalAplicavel: boolean;
};
export type CartaoFiscalLocal = {
  TipoIntegracao: boolean; CNPJCredenciadora: string; BandeiraOperadora: string; NumeroAutorizacao: string;
};
export type MapeamentoPagamentoLocal = {
  formaId: string; FormaPagamento: string; IndicadorPagamento: 0 | 1;
  Descricao?: string; cartao?: CartaoFiscalLocal;
};
export type ParametrosPayloadLocalBrasilNfe = {
  /** Complementos fiscais aprovados para esta fotografia; não reescrevem cadastros/pedido. */
  vinculo: { documentoId: string; hashPayload: string; revisaoPedido: number };
  referenciaFundamentacao?: string;
  /** Compatibilidade de leitura do complemento legado; não aprova nova regra. */
  referenciaConfirp?: string;
  emitente: { crt: 1 | 2 | 3 | 4; ie: string; codMunicipio: string; codPais: number; pais: string };
  operacao: {
    NaturezaOperacao: string; Finalidade: 1; IndicadorPresenca: 0 | 1 | 2 | 3 | 4 | 5 | 9;
    ConsumidorFinal: boolean; CalcularIBPT: boolean; ModalidadeFrete: 0 | 1 | 2 | 3 | 4 | 9;
    intermediadorAplicavel: boolean;
  };
  destinatario: { identificar: false } | {
    identificar: true; origem: "comprador" | "cobranca" | "destinatario";
    IndicadorIe: 1 | 2 | 9; endereco: EnderecoFiscalLocal;
  };
  pagamentos: { fonte: "TOTAL" | "PARCELAS"; mapeamentos: MapeamentoPagamentoLocal[]; incluirCobranca: boolean; troco: DecimalFiscalLocal };
  itens: RegraItemFiscalLocal[];
};
export type DocumentoPreparacaoLocalBrasilNfe = {
  id: string; hashPayload: string; versaoPedido: number; payload: unknown;
};
export type CadastroEmitenteLocalBrasilNfe = { nome: string | null; cnpj: string | null; enderecoEstruturado: unknown };
export type ImpostosPayloadLocalBrasilNfe = {
  ICMS: { CodSituacaoTributaria: string; BaseCalculo?: DecimalFiscalLocal; AliquotaICMS?: DecimalFiscalLocal; ValorIcms?: DecimalFiscalLocal; modalidadeBcIcms?: number };
  PIS: { CodSituacaoTributaria: string; BaseCalculo?: DecimalFiscalLocal; Aliquota?: DecimalFiscalLocal };
  COFINS: { CodSituacaoTributaria: string; BaseCalculo?: DecimalFiscalLocal; Aliquota?: DecimalFiscalLocal };
};
export type ProdutoPayloadLocalBrasilNfe = {
  CodProdutoServico: string; NmProduto: string; UnidadeComercial: string;
  Quantidade: DecimalFiscalLocal; ValorUnitario: DecimalFiscalLocal; ValorTotal: DecimalFiscalLocal;
  ValorDesconto: DecimalFiscalLocal; ValorFrete: DecimalFiscalLocal; ValorOutrasDespesas: DecimalFiscalLocal;
  NCM: string; CEST?: string; EAN: string; CFOP: number; OrigemProduto: number;
  nFCI?: string;
  UnidadeComercialTributavel: string; QuantidadeTributavel: DecimalFiscalLocal; ValorUnitarioTributavel: DecimalFiscalLocal;
  Imposto: ImpostosPayloadLocalBrasilNfe;
};
export type PagamentoPayloadLocalBrasilNfe = {
  FormaPagamento: string; IndicadorPagamento: number; VlPago: DecimalFiscalLocal; VlTroco: DecimalFiscalLocal;
  Descricao?: string;
} & Partial<CartaoFiscalLocal>;
export type PayloadNotaLocalBrasilNfe = {
  IdentificadorInterno: string; ModeloDocumento: ModeloDocumentoBrasilNfe; TipoAmbiente: 1 | 2; EnviarEmail: false;
  NaturezaOperacao: string; Finalidade: 1; IndicadorPresenca: number; ConsumidorFinal: boolean; CalcularIBPT: boolean;
  Observacao?: string;
  Cliente?: { CpfCnpj: string; NmCliente: string; IndicadorIe: number; Ie?: string; Endereco: EnderecoPayloadBrasilNfe };
  Produtos: ProdutoPayloadLocalBrasilNfe[]; Pagamentos: PagamentoPayloadLocalBrasilNfe[];
  Cobranca?: { Fatura: { Numero: string; Valor: DecimalFiscalLocal; Desconto: DecimalFiscalLocal; ValorLiquido: DecimalFiscalLocal }; Parcelas: { Vencimento: string; Valor: DecimalFiscalLocal }[] };
  Transporte: { ModalidadeFrete: number }; ValorTotal: DecimalFiscalLocal;
};
export type PendenciaPayloadLocalBrasilNfe = {
  campo: string; codigo: "AUSENTE" | "FORMATO" | "DIVERGENTE" | "NAO_SUPORTADO";
  motivo: string; responsavel: "HUB" | "REVISAO_FISCAL";
  itemId?: string; produtoId?: string; operacao: "NF_E_VENDA" | "NFC_E_VENDA";
};
export type ResultadoPayloadLocalBrasilNfe = {
  documentoId: string; hashPayload: string; modelo: ModeloDocumentoBrasilNfe;
  montagemConcluida: boolean; transmissaoPermitida: false;
  payload: PayloadNotaLocalBrasilNfe | null; pendencias: PendenciaPayloadLocalBrasilNfe[];
};
