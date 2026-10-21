/** DTOs internos: nenhuma resposta completa nem credencial do fornecedor sai do cliente. */
export type { MetadadosErroBrasilNfe } from "./diagnostico-http";
export type EmpresaBrasilNfeSanitizada = {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  crt: 1 | 2 | 3 | 4 | null;
  endereco: {
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    codigoMunicipio: string | null;
    municipio: string | null;
    uf: string | null;
  };
  nfceHomologacao: { idCscConfigurado: boolean; cscConfigurado: boolean };
  nfceProducao?: { idCscConfigurado: boolean; cscConfigurado: boolean };
};

export type ServicosBrasilNfeSanitizados = {
  servicos: { nome: string; ativo: boolean }[];
  avisosPresentes: boolean;
};

/** Contador informativo do fornecedor. Esta consulta não reserva número. */
export type NumeracoesBrasilNfeSanitizadas = {
  numeracoes: { ambiente: 1 | 2; modelo: 55 | 65; serie: string; numero: string; padrao: boolean }[];
  avisosPresentes: boolean;
  /** Somente contagem de entradas descartadas; os contadores de outros modelos não são validados. */
  itensForaEscopo?: number;
};

export type RequisicaoConsultaBrasilNfe = {
  documentoId: string;
  modelo: 55 | 65;
  ambiente: "HOMOLOGACAO" | "PRODUCAO";
};

export type RequisicaoConsultaBrasilNfeHttp = {
  IdentificadorInterno: string;
  TipoAmbiente: 1 | 2;
  ModeloDocumento: 55 | 65;
  RetornarArquivos: false;
};

/** A evidência externa não é um evento ordenado do HUB nem autorização de reenvio. */
export type NotaConsultadaBrasilNfe = {
  ModeloDocumento: 55 | 65;
  IdentificadorInterno: string;
  CodTipoAmbiente: 1 | 2;
  Status: number;
  Emitida: boolean;
  Chave: string | null;
  Numero: string | null;
  Serie: string | null;
  NumeroProtocolo: string | null;
  CodStatusResposta: number | null;
  DtEmissao: string | null;
  DtRecebimento: string | null;
  CnpjEmissor?: string;
};

export type ConsultaNotaFiscalBrasilNfe = {
  Encontrada: boolean;
  Nota: NotaConsultadaBrasilNfe | null;
  Historico: NotaConsultadaBrasilNfe[];
  /** Só o código documentado de ausência atravessa a projeção; textos são descartados. */
  erros: [] | [{ codigo: "BR0008" }];
  avisos: [];
  avisosPresentes: boolean;
  /** Envelope de consulta, separado de Nota.Status. 0 é compatibilidade do exemplo publicado. */
  status: 0 | 1;
};

export type CertificadoInternoBrasilNfe = { valido: boolean; expirado: boolean; dataExpiracao: string; avisosPresentes: boolean };
export type RequisicaoArquivoNotaBrasilNfe = { ChaveNF: string; FileType: 1 | 2; TipoDocumentoFiscal: 1 };
export type RequisicaoArquivoEventoBrasilNfe = { ChaveNF: string; NuProtocolo: string; TipoArquivo: 1 };
export type RequisicaoCancelamentoBrasilNfe = { ChaveNF: string; Justificativa: string; TipoAmbiente: 1 | 2; NumeroProtocolo: string; TipoDocumento: 0 };
/** Projeção estrita, sem descrições/avisos/detalhes fiscais brutos. */
export type RetornoEnvioBrasilNfe = {
  numero: string | null; serie: string | null; chave: string | null; protocolo: string | null;
  codigoSefaz: number | null; ok: boolean | null; ambiente: 1 | 2 | null; erroPresente: boolean;
  Base64Xml?: string; Base64File?: string;
};
export type RetornoCancelamentoBrasilNfe = {
  statusEvento: 1 | 2 | 3; codigoSefaz: number | null; protocoloCancelamento: string | null;
  numeroSequencialEvento: number | null; erroPresente: boolean; Base64Xml?: string;
};
