/** Rótulos locais fixos; este módulo pode ser usado pela interface sem importar o cliente HTTP. */
export const ETAPAS_CONTRATO_BRASILNFE = Object.freeze({
  CONTENT_TYPE: "Content-Type JSON",
  UTF8: "codificação UTF-8",
  JSON: "sintaxe JSON",
  OBJETO_JSON: "objeto JSON principal",
  EMPRESA_ENVELOPE: "campos de erro da empresa",
  EMPRESA_STATUS: "status da empresa",
  EMPRESA_CNPJ: "CNPJ da empresa",
  EMPRESA_CNPJ_AUSENTE: "CNPJ ausente na resposta",
  EMPRESA_CNPJ_NULO: "CNPJ nulo na resposta",
  EMPRESA_CNPJ_NUMERICO: "CNPJ numérico (esperado: texto)",
  EMPRESA_CNPJ_TIPO: "tipo do CNPJ (esperado: texto)",
  EMPRESA_CNPJ_MASCARADO: "CNPJ com pontuação (esperado: texto de 14 dígitos)",
  EMPRESA_CNPJ_CPF: "CPF no campo CNPJ (esperado: CNPJ de 14 dígitos)",
  EMPRESA_CNPJ_FORMATO: "formato do CNPJ (esperado: texto de 14 dígitos)",
  EMPRESA_CRT: "CRT da empresa",
  EMPRESA_ENDERECO: "objeto Endereco",
  EMPRESA_CONFIGURACAO: "objeto Configuracao",
  EMPRESA_NFCE: "objeto Configuracao.NFCe",
  EMPRESA_UF: "Endereco.Uf",
  EMPRESA_RAZAO_SOCIAL: "RzSocial",
  EMPRESA_NOME_FANTASIA: "NmFantasia",
  EMPRESA_IE: "IE",
  EMPRESA_CEP: "Endereco.Cep",
  EMPRESA_LOGRADOURO: "Endereco.Logradouro",
  EMPRESA_NUMERO: "Endereco.Numero",
  EMPRESA_BAIRRO: "Endereco.Bairro",
  EMPRESA_COD_MUNICIPIO: "Endereco.CodMunicipio",
  EMPRESA_MUNICIPIO: "Endereco.Municipio",
  EMPRESA_ID_CSC: "formato de Configuracao.NFCe.IdCSCHomologacao",
  EMPRESA_CSC: "formato de Configuracao.NFCe.CSCHomologacao",
  SERVICOS_ENVELOPE: "campos de status e erro dos serviços",
  SERVICOS_LISTA: "lista Servicos",
  SERVICOS_ITEM: "item de Servicos",
  SERVICOS_NOME: "Servicos.Nome",
  SERVICOS_ATIVO: "Servicos.Ativo",
  SERVICOS_AVISOS: "avisos dos serviços",
  NUMERACAO_ENVELOPE: "status booleano da consulta de numeração",
  NUMERACAO_LISTA: "lista Numeracoes",
  NUMERACAO_ITEM: "modelo, ambiente, série e contador de Numeracoes",
  NUMERACAO_AVISOS: "avisos da consulta de numeração",
  NOTA_ENVELOPE: "campos de status e erro da consulta fiscal",
  NOTA_CAMPOS: "identidade e campos de Nota/Historico",
  NOTA_AVISOS: "avisos da consulta fiscal",
  CERTIFICADO_ENVELOPE: "resposta da verificação do certificado interno",
  CERTIFICADO_STATUS: "status booleano do certificado",
  CERTIFICADO_EXPIRADO: "indicador Expirado do certificado",
  CERTIFICADO_ERROR: "campo Error do certificado",
  CERTIFICADO_DATA: "data de validade do certificado",
  ENVIO_ENVELOPE: "resposta da transmissão individual",
  CANCELAMENTO_ENVELOPE: "resposta do evento de cancelamento",
  ARQUIVO_ENVELOPE: "formato Base64 do arquivo fiscal",
  SEGREDO_REFLETIDO: "proteção de credenciais na resposta",
} as const);
export type EtapaContratoBrasilNfe = keyof typeof ETAPAS_CONTRATO_BRASILNFE;

export const CATEGORIAS_DIAGNOSTICO_BRASILNFE = Object.freeze({
  TRANSPORTE: "Falha de transporte",
  TIMEOUT: "Prazo de consulta excedido",
  HTTP: "Resposta HTTP não aceita",
  NAO_JSON: "Resposta sem JSON",
  JSON_INVALIDO: "JSON ou codificação inválida",
  CONTRATO: "Campo fora do contrato",
  NEGOCIO: "Falha informada na resposta JSON",
  LIMITE: "Limite de resposta excedido",
  CONFIGURACAO: "Configuração ou bloqueio local",
} as const);
export type CategoriaDiagnosticoBrasilNfe = keyof typeof CATEGORIAS_DIAGNOSTICO_BRASILNFE;

export const INDICADORES_MOTIVO_BRASILNFE = Object.freeze({
  ERROR_PREENCHIDO: "Error não vazio",
  ERROS_PREENCHIDOS: "Lista de erros preenchida",
  STATUS_FALSE: "Status booleano false observado",
  STATUS_NUMERICO_NAO_ZERO: "Status numérico diferente de zero observado",
  FORMATO_INCOMPATIVEL: "Formato incompatível com o contrato",
} as const);
export type IndicadorMotivoBrasilNfe = keyof typeof INDICADORES_MOTIVO_BRASILNFE;
export const CAMPOS_MOTIVO_BRASILNFE = Object.freeze({
  ERROR: "Error", ERROS: "erros", STATUS: "status", SERVICOS: "Servicos",
  ERROS_CODIGO: "erros.codigo", ERROS_DESCRICAO: "erros.descricao", ERROS_CORRECAO: "erros.correcao",
} as const);
export type CampoMotivoBrasilNfe = keyof typeof CAMPOS_MOTIVO_BRASILNFE;
export const ESTADOS_CAMPO_DIAGNOSTICO_BRASILNFE = Object.freeze({
  AUSENTE: "Ausente", VAZIO: "Vazio", EXIBIDO: "Texto saneado", SUPRIMIDO: "Suprimido por segurança", FORMATO_INVALIDO: "Formato inválido",
} as const);
export type EstadoCampoDiagnosticoBrasilNfe = keyof typeof ESTADOS_CAMPO_DIAGNOSTICO_BRASILNFE;
export type CampoTextoDiagnosticoBrasilNfe = Readonly<{ estado: EstadoCampoDiagnosticoBrasilNfe; valor: string | null }>;
export type CampoCodigoDiagnosticoBrasilNfe = Readonly<{ estado: EstadoCampoDiagnosticoBrasilNfe; valor: string | number | null }>;
export type DetalhesDiagnosticoServicosBrasilNfe = Readonly<{
  error: CampoTextoDiagnosticoBrasilNfe;
  erros: readonly Readonly<{ codigo: CampoCodigoDiagnosticoBrasilNfe; descricao: CampoTextoDiagnosticoBrasilNfe; correcao: CampoTextoDiagnosticoBrasilNfe }>[];
  quantidadeErros: number | null;
  camposAusentes: readonly CampoMotivoBrasilNfe[];
  camposSuprimidos: readonly CampoMotivoBrasilNfe[];
}>;
export const TIPOS_STATUS_FORNECEDOR_BRASILNFE = Object.freeze({ AUSENTE: "Ausente", NULO: "Nulo", NUMERO: "Número", BOOLEANO: "Booleano", OUTRO: "Tipo incompatível" } as const);
export const ESTADOS_STATUS_FORNECEDOR_BRASILNFE = Object.freeze({
  AUSENTE: "Ausente", NULO: "Nulo", ZERO: "Zero observado", NUMERO_NAO_ZERO: "Número diferente de zero", FALSE: "False observado",
  TRUE: "True observado", FORA_LIMITE: "Fora do limite local", INCOMPATIVEL: "Formato incompatível",
  SUPRIMIDO_SEGREDO: "Valor suprimido por refletir credencial",
} as const);
export type TipoStatusFornecedorBrasilNfe = keyof typeof TIPOS_STATUS_FORNECEDOR_BRASILNFE;
export type EstadoStatusFornecedorBrasilNfe = keyof typeof ESTADOS_STATUS_FORNECEDOR_BRASILNFE;
export const LIMITE_STATUS_OBSERVADO_BRASILNFE = 999999;

/** Somente posição e classificações locais. Nenhum valor recebido é conservado. */
export const CAMPOS_ITEM_NUMERACAO_BRASILNFE = Object.freeze({
  ITEM: "item", ModeloDocumento: "ModeloDocumento", TipoAmbiente: "TipoAmbiente", Serie: "Serie", Numero: "Numero", Padrao: "Padrao",
} as const);
export const TIPOS_ITEM_NUMERACAO_BRASILNFE = Object.freeze({
  AUSENTE: "ausente", NULO: "nulo", BOOLEANO: "booleano", INTEIRO: "número inteiro", NUMERO_NAO_INTEIRO: "número não inteiro",
  TEXTO: "texto", ARRAY: "lista", OBJETO: "objeto", OUTRO: "tipo não suportado",
} as const);
export const MOTIVOS_ITEM_NUMERACAO_BRASILNFE = Object.freeze({
  AUSENTE: "campo obrigatório ausente", NULO: "campo obrigatório nulo", TIPO_INCOMPATIVEL: "tipo incompatível com o contrato",
  FORA_LISTA: "valor fora da lista documentada", FORA_LIMITE: "valor fora do limite permitido", FORMATO_INCOMPATIVEL: "formato incompatível com o contrato",
  SERIE_DUPLICADA: "série equivalente repetida no mesmo modelo e ambiente", PADRAO_DUPLICADO: "mais de uma série padrão no mesmo modelo e ambiente",
} as const);
export type ItemNumeracaoDiagnosticoBrasilNfe = Readonly<{
  /** Posição na lista externa, iniciada em 1. */
  posicao: number;
  campo: keyof typeof CAMPOS_ITEM_NUMERACAO_BRASILNFE;
  tipoObservado: keyof typeof TIPOS_ITEM_NUMERACAO_BRASILNFE;
  motivo: keyof typeof MOTIVOS_ITEM_NUMERACAO_BRASILNFE;
}>;
export function sanitizarItemNumeracaoBrasilNfe(entrada: unknown): ItemNumeracaoDiagnosticoBrasilNfe | null {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return null;
  const v = entrada as Record<string, unknown>;
  if (typeof v.posicao !== "number" || !Number.isSafeInteger(v.posicao) || v.posicao < 1 || v.posicao > 1000
    || typeof v.campo !== "string" || !Object.hasOwn(CAMPOS_ITEM_NUMERACAO_BRASILNFE, v.campo)
    || typeof v.tipoObservado !== "string" || !Object.hasOwn(TIPOS_ITEM_NUMERACAO_BRASILNFE, v.tipoObservado)
    || typeof v.motivo !== "string" || !Object.hasOwn(MOTIVOS_ITEM_NUMERACAO_BRASILNFE, v.motivo)) return null;
  return Object.freeze({ posicao: v.posicao, campo: v.campo as ItemNumeracaoDiagnosticoBrasilNfe["campo"],
    tipoObservado: v.tipoObservado as ItemNumeracaoDiagnosticoBrasilNfe["tipoObservado"], motivo: v.motivo as ItemNumeracaoDiagnosticoBrasilNfe["motivo"] });
}

export type MetadadosErroBrasilNfe = Readonly<{
  categoria: CategoriaDiagnosticoBrasilNfe;
  httpStatus: number | null;
  etapaContrato: EtapaContratoBrasilNfe | null;
  /** Valor observado do envelope. Sua semântica depende do endpoint e nunca comprova autorização fiscal. */
  statusFornecedor: number | boolean | null;
  /** Compatibilidade do histórico: códigos observados ficam só nos detalhes transitórios, nunca na auditoria. */
  codigoFornecedor: null;
  indicadores?: readonly IndicadorMotivoBrasilNfe[];
  tipoStatusFornecedor?: TipoStatusFornecedorBrasilNfe;
  estadoStatusFornecedor?: EstadoStatusFornecedorBrasilNfe;
  camposAusentes?: readonly CampoMotivoBrasilNfe[];
  camposSuprimidos?: readonly CampoMotivoBrasilNfe[];
  itemNumeracao?: ItemNumeracaoDiagnosticoBrasilNfe;
}>;

function listaEnum<T extends string>(entrada: unknown, mapa: Record<T, string>): readonly T[] {
  if (!Array.isArray(entrada)) return Object.freeze([]);
  return Object.freeze([...new Set(entrada.slice(0, 64).filter((item): item is T => typeof item === "string" && Object.hasOwn(mapa, item)))].slice(0, Object.keys(mapa).length));
}

/** Lê JSON persistido pela lista permitida, sem conservar campos, mensagens ou valores extras. */
export function sanitizarMetadadosErroBrasilNfe(entrada: unknown): MetadadosErroBrasilNfe | null {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return null;
  const dados = entrada as Record<string, unknown>;
  if (typeof dados.categoria !== "string" || !Object.hasOwn(CATEGORIAS_DIAGNOSTICO_BRASILNFE, dados.categoria)) return null;
  const itemNumeracao = dados.categoria === "CONTRATO" && dados.etapaContrato === "NUMERACAO_ITEM" ? sanitizarItemNumeracaoBrasilNfe(dados.itemNumeracao) : null;
  const tipo = typeof dados.tipoStatusFornecedor === "string" && Object.hasOwn(TIPOS_STATUS_FORNECEDOR_BRASILNFE, dados.tipoStatusFornecedor)
    ? dados.tipoStatusFornecedor as TipoStatusFornecedorBrasilNfe : undefined;
  let estado = typeof dados.estadoStatusFornecedor === "string" && Object.hasOwn(ESTADOS_STATUS_FORNECEDOR_BRASILNFE, dados.estadoStatusFornecedor)
    ? dados.estadoStatusFornecedor as EstadoStatusFornecedorBrasilNfe : undefined;
  let statusFornecedor: number | boolean | null = dados.statusFornecedor === 0 ? 0 : null;
  if (tipo || estado) {
    statusFornecedor = tipo === "NUMERO" && typeof dados.statusFornecedor === "number" && Number.isSafeInteger(dados.statusFornecedor)
      && Math.abs(dados.statusFornecedor) <= LIMITE_STATUS_OBSERVADO_BRASILNFE && estado === (dados.statusFornecedor === 0 ? "ZERO" : "NUMERO_NAO_ZERO")
      ? dados.statusFornecedor : tipo === "BOOLEANO" && typeof dados.statusFornecedor === "boolean" && estado === (dados.statusFornecedor ? "TRUE" : "FALSE")
        ? dados.statusFornecedor : null;
    const estadoSemValor = estado === "SUPRIMIDO_SEGREDO" || estado === "INCOMPATIVEL"
      || (tipo === "AUSENTE" && estado === "AUSENTE") || (tipo === "NULO" && estado === "NULO")
      || (tipo === "NUMERO" && estado === "FORA_LIMITE");
    if (statusFornecedor === null && !estadoSemValor) estado = "INCOMPATIVEL";
  }
  return Object.freeze({
    categoria: dados.categoria as CategoriaDiagnosticoBrasilNfe,
    httpStatus: typeof dados.httpStatus === "number" && Number.isSafeInteger(dados.httpStatus)
      && dados.httpStatus >= 100 && dados.httpStatus <= 599 ? dados.httpStatus : null,
    etapaContrato: typeof dados.etapaContrato === "string" && Object.hasOwn(ETAPAS_CONTRATO_BRASILNFE, dados.etapaContrato)
      ? dados.etapaContrato as EtapaContratoBrasilNfe : null,
    statusFornecedor,
    codigoFornecedor: null,
    ...(itemNumeracao ? { itemNumeracao } : {}),
    ...(Object.hasOwn(dados, "indicadores") ? { indicadores: listaEnum(dados.indicadores, INDICADORES_MOTIVO_BRASILNFE) } : {}),
    ...(tipo ? { tipoStatusFornecedor: tipo } : {}),
    ...(estado ? { estadoStatusFornecedor: estado } : {}),
    ...(Object.hasOwn(dados, "camposAusentes") ? { camposAusentes: listaEnum(dados.camposAusentes, CAMPOS_MOTIVO_BRASILNFE) } : {}),
    ...(Object.hasOwn(dados, "camposSuprimidos") ? { camposSuprimidos: listaEnum(dados.camposSuprimidos, CAMPOS_MOTIVO_BRASILNFE) } : {}),
  });
}
