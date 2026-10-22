export const GRUPOS_FISCAIS = [
  ["GF01", "Alimentação preparada: tábuas e frios"], ["GF02", "Alimentação preparada: salgados"],
  ["GF03", "Alimentação preparada: doces"], ["GF04", "Preparações próprias avulsas"],
  ["GF05", "Alimentos avulsos ou fracionados"], ["GF06", "Empório e revenda alimentar"],
  ["GF07", "Bebidas não alcoólicas industrializadas"], ["GF08", "Bebidas preparadas no estabelecimento"],
  ["GF09", "Cervejas"], ["GF10", "Vinhos, espumantes e licores"],
  ["GF11", "Embalagens e utensílios vendidos"], ["GF12", "Serviços de eventos"],
] as const;
export type CodigoGrupoFiscal = typeof GRUPOS_FISCAIS[number][0];
export type TipoVersaoFiscal = "CLASSIFICACAO" | "PERFIL" | "REGRA" | "TABELA" | "COMPLEMENTO";
export type RegimeFiscal = "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO";
export type NaturezaFiscal = "PREPARADO" | "REVENDA" | "FRACIONADO" | "SERVICO";
export type MateriaisFiscaisFotografados = { algoritmo: "grazing.material-fiscal.v1"; insumos: { insumoId: string; hash: string; transitiva: boolean }[] };
export type MateriaisReceitaFiscal = { principal: MateriaisFiscaisFotografados; opcoes: { opcaoId: string; materiais: MateriaisFiscaisFotografados }[] };
export type AnaliseNcm = {
  fundamento: "DOCUMENTAL" | "PESQUISA"; confianca: "ALTA" | "MEDIA" | "BAIXA";
  descricaoNcm: string | null; dataAnalise: string; justificativa: string; fontes: string[];
  /** Separadas das pendências operacionais que continuam impedindo a emissão. */
  pendenciasNcm: string[];
};
export type ReceitaFiscalDocumentada = { componentesFixos: { insumoId: string; unidade: string; quantidade: string }[]; opcoes: { opcaoId: string; componentes: { insumoId: string; unidade: string; quantidade: string }[] }[]; justificativa: string; fontes: string[] };
export type ConfiguracaoNcm = {
  grupoIds: string[]; padraoSemEscolhasAutorizado: boolean;
  modoFiscal?: "PREPARACAO_UNICA" | "UNIDADES_SEPARADAS";
  gruposEquivalentes?: { grupoId: string; opcaoIds: string[]; quantidadeMinima: string; quantidadeMaxima: string; analiseNcm: AnaliseNcm }[];
  cenarios: { id: string; nome: string; opcaoIds: string[]; quantidadesEscolhidas?: { opcaoId: string; quantidade: string }[]; ncm: string | null; analiseNcm: AnaliseNcm }[];
  /** Gerada pelo servidor ao salvar, nunca aceita como comprovação enviada pelo navegador. */
  fotografiaTecnica?: { algoritmo: "grazing.receita-fiscal.v1"; principalHash: string; opcaoHashes: { opcaoId: string; hash: string }[]; materiais?: MateriaisReceitaFiscal; documentacaoHash?: string };
};
export type CenarioNcmCalculado = { id: string; nome: string; opcaoIds: string[]; classificacaoVersaoId: string };
export type ClassificacaoFiscal = {
  herdarOrigemGrupo?: boolean;
  produtoId: string | null; grupoFiscalId?: string | null; referenciaInternaInsumoId?: string; grupo: CodigoGrupoFiscal | null; natureza: NaturezaFiscal;
  tratamento: "NORMAL" | "KIT_COMPOSTO" | "OPCAO_CONFIGURACAO";
  ncm: string | null; origem: string | null; cest: string | null; unidade: string;
  /** GTIN da unidade vendida e tributável idênticas; null/ausente exige conferência. */
  gtin?: string | null;
  /** Decisão e apuração aprovadas na mesma versão; ausência preserva hashes históricos. */
  fci?: DecisaoFciFiscal;
  estado: "CONFIRMADO" | "PENDENTE"; evidencias: string[]; pendencias: string[];
  /** Ausentes em versões históricas; autoria vem da versão imutável validada no servidor. */
  ncmAplicabilidade?: "APLICAVEL" | "NAO_APLICAVEL";
  analiseNcm?: AnaliseNcm;
  configuracaoNcm?: ConfiguracaoNcm;
  /** Prova documentada de que as escolhas representam o item inteiro, sem ingredientes fixos omitidos. */
  baseSemIngredientesComprovada?: boolean;
  /** Quantidade final por unidade fiscal e por uma escolha; não substitui receita/consumo de estoque. */
  receitaFiscalDocumentada?: ReceitaFiscalDocumentada;
  /** Receita física normal/interna selada no servidor; input do cliente é ignorado. */
  fotografiaTecnica?: { algoritmo: "grazing.classificacao-fiscal.v1"; principalHash: string; materiais: MateriaisFiscaisFotografados; documentacaoHash?: string };
  conversaoUnidade?: { unidadeEstoque: string; quantidadeEstoquePorUnidadeFiscal: string; justificativa: string; fontes: string[] };
  componentesKit?: { produtoId?: string; referenciaInternaInsumoId?: string; descricao?: string; unidade?: string; quantidade: string; pesoRateio: string; escolhas?: { opcaoId: string; grupoId: string; quantidade: string }[]; receitaFotografada?: ItemComercialFiscal["receitaFotografada"] }[];
};
export type DecisaoFciFiscal = {
  situacao: "EXIGIDA" | "DISPENSADA_COM_FUNDAMENTO" | "DISPENSADA_POR_DECLARACAO_RESPONSAVEL" | "PENDENTE";
  numero: string | null; periodoApuracao: string | null; conteudoImportacao: string | null;
  valorParcelaImportada: string | null; valorSaidaReferencia: string | null; apuracaoCompleta: boolean;
  justificativa: string; fontes: string[]; evidencias: string[];
  /** Dispensa delimitada; não vale automaticamente para outro destino ou modelo. */
  dispensa?: { ufEmitente: string; ufDestino: string; modelos: ("55" | "65")[] };
  /** Declaração administrativa não comprova CI nem conclusão normativa. */
  declaracaoResponsavel?: DeclaracaoResponsavelFci;
  /** Pedido explícito; o servidor reconstrói a prova das entradas antes de salvar/ativar. */
  repasseFornecedor?: RepasseFciFornecedor;
};
export type RepasseFciFornecedor = { insumoId: string; registro?: {
  algoritmo: "grazing.fci-fornecedor.v1"; natureza: "FRACIONADO" | "REVENDA";
  ncm: string; origem: string; materiaisHash: string;
  documentos: { itemId: string; numeroItem: number; xmlHash: string; dataEmissao: string }[];
} };
export type DeclaracaoResponsavelFci = {
  tipo: "ORIGEM_FCI_GTIN"; produtoId: string; estabelecimento: "singleton"; emitenteCnpj: string; materiaisHash: string;
  classificacaoBase: { id: string; hash: string; versao: number }; vigenciaInicio: string;
  ufEmitente: "SP"; ufDestino: "SP"; modelos: ["55"]; ambientes: ["HOMOLOGACAO", "PRODUCAO"];
  origem: "5"; gtin: "SEM GTIN"; reaproveitamento65: "EXIGE_HOMOLOGACAO_PROPRIA";
  referenciaInstrucao: string; executorModo: "SESSAO_NORMAL" | "AUTOMACAO_ASSISTIDA";
  registro?: { versaoId: string; versao: number; registradoEm: string; responsavel: { usuarioId: string; nome: string };
    executor: { usuarioId: string; nome: string; modo: "SESSAO_NORMAL" | "AUTOMACAO_ASSISTIDA"; identificacao: "Sessão normal" | "Codex" }; hashConteudo: string };
};
export type PerfilFiscal = {
  estabelecimento: string; cnpj: string; uf: string; codigoMunicipio: string; inscricaoEstadual: string;
  regime: RegimeFiscal; confirmado: boolean; evidenciaEnquadramento: string;
  /** Opcional apenas para preservar versões históricas. Emissão exige CRT explícito. */
  crt?: 1 | 2 | 3 | 4;
  modelos: ("55" | "65")[]; emissor: "TAKEAT" | "BRASIL_NFE" | "MANUAL";
  reforma: "DISPENSADO_SIMPLES_2026" | "EXIGIR_REGRA";
  beneficioOpcional: null | { codigo: string; elegibilidade: string; opcaoComprovada: string; fim: string };
  layoutRTC?: LayoutFiscalRTC;
};
export type LayoutFiscalRTC = {
  codigo: "NT2026.008"; homologacaoComprovada: boolean; evidenciaHomologacao: string;
  /** Caminhos documentados e comprovados na API; não são nomes presumidos. */
  campos: { valorProdutoLiquido: string | null; valorUnitarioLiquido: string | null;
    valorLiquidoProdutosTotal: string | null; valorTotalItem: string | null; valorTotalDocumento: string | null };
};
export type TributoConfigurado = {
  cst: string; aliquota: string | null; reducaoBase: string; modalidade: "TRIBUTADO" | "SEM_DESTAQUE";
  justificativa: string;
};
export type RegraFiscal = {
  origem?: string | null;
  habilitada?: boolean;
  estabelecimento: string; regime: RegimeFiscal; operacao: "VENDA"; ufDestino: string;
  destinatario: "CONSUMIDOR_FINAL" | "CONTRIBUINTE"; grupo: CodigoGrupoFiscal | null;
  produtoId: string | null; grupoFiscalId?: string | null; modelo?: "55" | "65"; natureza: NaturezaFiscal | null; ncm: string | null;
  cfop: string; csosn: string | null; icms: TributoConfigurado; pis: TributoConfigurado;
  cofins: TributoConfigurado; ipi: TributoConfigurado | null;
  st: "NAO_APLICAVEL" | "RETIDO_ANTERIORMENTE" | "CALCULO_PENDENTE";
  evidenciaSt?: string;
  cest: string | null; segregacaoReceita: string;
  reforma: null | { cst: string; cClassTrib: string; cbs: string; ibsUf: string; ibsMunicipio: string; reducao: string; justificativa: string;
    preco2027?: { baseIcms: "BRUTA" | "LIQUIDA_RTC"; rateio: "SEM_ACRESCIMOS" | "PROPORCIONAL_BRUTO"; justificativa: string;
      excecaoBaseLiquida?: { uf: string; vigenciaInicio: string; vigenciaFim: string | null; fonteNormativa: string; ato: string; justificativa: string } } };
  seletivo: "NAO_APLICAVEL" | "ANALISE_PENDENTE";
};
export type TabelaFiscal = {
  tabela: "NCM" | "CFOP" | "CSOSN" | "CST_ICMS" | "CST_PIS_COFINS" | "CST_IPI" | "CEST" | "CST_IBSCBS" | "CCLASSTRIB";
  referencia: string; completa: boolean;
  linhas: { codigo: string; descricao: string; ncm?: string[]; cst?: string; regimes?: RegimeFiscal[]; modelos?: ("55" | "65")[]; aliquota?: string; reducao?: string }[];
};
export type ComportamentoFiscal = {
  opcaoId: string; comportamento: "INCLUIDO" | "INTEGRADO" | "MERCADORIA" | "APRESENTACAO";
  produtoId: string | null; justificativa: string;
  escolhas?: { opcaoId: string; grupoId: string; quantidade: string }[];
  /** Identidades físicas geradas e conferidas pelo servidor, nunca aceitas do cliente. */
  receitaFotografada?: ItemComercialFiscal["receitaFotografada"];
  fotografiaOpcaoOrigem?: string;
};
export type DadosVersaoFiscal = ClassificacaoFiscal | PerfilFiscal | RegraFiscal | TabelaFiscal | ComportamentoFiscal;
export type VersaoFiscalDto = {
  id: string; tipo: TipoVersaoFiscal; chave: string; versao: number; vigenciaInicio: string;
  status: "RASCUNHO" | "ATIVO"; dados: DadosVersaoFiscal; justificativa: string; fontes: string[];
  criadoPorNome: string; createdAt: string; hash: string;
};
export type SalvarVersaoFiscalEntrada = {
  tipo: TipoVersaoFiscal; chave: string; versaoBase: number; vigenciaInicio: string;
  dados: unknown; justificativa: string; fontes: string[]; chaveOperacao: string;
};
export type ImpactoFiscal = { hash: string; produtosAfetados: number; documentosPreservados: number; resumo: string[]; produtos: { id: string; nome: string; motivos: string[] }[] };
export type ContextoFiscal = { data: string; estabelecimento: string; ufDestino: string; destinatario: "CONSUMIDOR_FINAL" | "CONTRIBUINTE"; consumidorFinal?: boolean; modelo: "55" | "65"; operacao: "VENDA"; frete?: string; outrosCustos?: string; ambiente?: "HOMOLOGACAO" | "PRODUCAO" };
export type FotografiaKitFiscal = { algoritmo: "grazing.kit-fiscal.v1"; classificacaoVersaoId: string; hashPolitica: string; componentes: NonNullable<ClassificacaoFiscal["componentesKit"]> };
export type ComprovacaoFisicaFiscal = { baseSemIngredientes: boolean; opcaoIdsComComposicao: string[] };
export type ReceitaFiscalDocumentadaSnapshot = { classificacaoVersaoId: string; receita: NonNullable<ItemComercialFiscal["receitaFotografada"]> };
export type ItemComercialFiscal = {
  id: string; produtoId: string; nome: string; quantidade: string; unidade: string; total: string;
  escolhas: { opcaoId: string; grupoId?: string | null; produtoId: string | null; nome: string; quantidade: string; quantidadeEscolhida?: string; valor: string; unidade?: string; receitaFotografada?: ItemComercialFiscal["receitaFotografada"] }[];
  receitaFotografada?: { principalHash: string; opcaoHashes: { opcaoId: string; hash: string }[]; materiais?: MateriaisReceitaFiscal; comprovacaoParcial?: ComprovacaoFisicaFiscal; documentacaoHash?: string };
  fotografiaKitFiscal?: FotografiaKitFiscal;
};
export type LinhaFiscalCalculada = {
  id: string; produtoId: string; nome: string; quantidade: string; unidade: string; valor: string;
  referenciaInternaInsumoId?: string;
  frete?: string; outrasDespesas?: string;
  ncm: string; origem: string; cest: string | null; cfop: string; csosn: string | null;
  gtin?: string | null;
  fci?: DecisaoFciFiscal;
  /** Proveniência necessária para conferir o alcance de uma declaração administrativa. */
  classificacaoVersao?: { id: string; versao: number; materiaisHash: string; natureza?: NaturezaFiscal; ncm?: string };
  cenarioNcm?: CenarioNcmCalculado;
  valoresRTC?: { produtoLiquido: string; unitarioLiquido: string; totalItem: string; explicacao: string[] };
  impostos: { icms: { cst: string; base: string; aliquota: string | null; valor: string; reducaoBase?: string }; pis: { cst: string; base: string; aliquota: string | null; valor: string }; cofins: { cst: string; base: string; aliquota: string | null; valor: string }; ipi: { cst: string; base: string; aliquota: string | null; valor: string } | null };
  reforma: null | { cst: string; cClassTrib: string; base: string; cbs: string; ibsUf: string; ibsMunicipio: string; aliquotaNominalCBS?: string; aliquotaNominalIbsUf?: string; aliquotaNominalIbsMunicipio?: string; reducao?: string; valorCbs: string; valorIbsUf: string; valorIbsMunicipio: string };
  segregacaoReceita: string; versoes: string[]; justificativas: string[];
};
export type RevisaoConsolidadaFiscal = { tipo: "PROPOSTAS_PARA_REVISAO"; versao: 1; ambiente: "HOMOLOGACAO" | "PRODUCAO"; aprovacaoInterna: false;
  versoes: { id: string; hash: string; versao: number; tipo: TipoVersaoFiscal; chave: string; statusOriginal: "RASCUNHO" | "ATIVO" }[] };
export type PreviaTributacao = { apto: boolean; pendencias: string[]; contexto: ContextoFiscal; perfilId: string | null; regime: RegimeFiscal | null; linhas: LinhaFiscalCalculada[]; totalMercadorias: string; justificativas: string[]; revisaoConsolidada?: RevisaoConsolidadaFiscal };
export type PainelFiscal = {
  produtos: { id: string; codigo: string | null; nome: string; tipo: string; papeis: string[]; grupo: string | null; ncm: string | null; status: "APTO" | "PENDENTE" | "CONFIGURACAO"; pendencias: string[]; composicao: unknown; evidencias: unknown; ncmAplicabilidade?: ClassificacaoFiscal["ncmAplicabilidade"]; analiseNcm?: AnaliseNcm; configuracaoNcm?: ConfiguracaoNcm }[];
  versoes: VersaoFiscalDto[]; grupos: { id: string; nome: string; ativo: boolean; codigo?: string | null }[];
  resumo: { ativos: number; aptos: number; pendentes: number; configuracoes: number };
  entradas: { produtoId: string; insumoId: string; insumo: string; ncm: string; descricao: string; evidencia: string }[];
  administrador: boolean;
  insumos?: { id: string; nome: string; tipo: string; unidade: string }[];
  opcoes: { id: string; nome: string; produtoId: string | null; grupo: string; grupoId?: string; produtoPrincipalIds?: string[] }[];
};
