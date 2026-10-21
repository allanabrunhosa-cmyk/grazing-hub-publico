import type { RegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";
export type AmbienteDashboardFiscal = "PRODUCAO" | "HOMOLOGACAO";
export type FiltrosDashboardFiscal = { mes: string; ambiente: AmbienteDashboardFiscal; de?: string; ate?: string };
export type TipoDocumentoDashboardFiscal = "NF_ENTRADA" | "NFC_ENTRADA" | "NF_SAIDA" | "NFS_ENTRADA";
export type MetricaDashboardFiscal = { valor: string | null; quantidade: number | null; motivo: string | null };
export type DocumentoDashboardFiscal = {
  id: string;
  origem: "SAIDA" | "ENTRADA";
  modelo: 55 | 65 | null;
  numero: string | null;
  status: string;
  dataFiscal: string | null;
  valor: string | null;
  pedidoId: string | null;
  pedidoNumero: string | null;
  tipo?: TipoDocumentoDashboardFiscal;
  detalhesDisponiveis?: boolean;
};
export type PendenciaDashboardFiscal = {
  codigo: string; titulo: string; descricao: string; quantidade: number | null; href: string | null;
};
export type EstadoServicoDashboardFiscal = "ATIVO" | "INATIVO" | "NAO_CONFIRMADO";
export type CertificadoDashboardFiscal = {
  situacao: "NAO_VERIFICADO" | "VIGENTE" | "A_VENCER" | "VENCIDO";
  validoAte: string | null;
  diasParaVencer: number | null;
};
export type IntegracaoDashboardFiscal = {
  ambienteConfigurado: string | null;
  configurada: boolean;
  credenciaisConfiguradas: boolean;
  situacao: "NAO_CONFIGURADA" | "NAO_VERIFICADA" | "CONECTADA" | "FALHOU" | "DESATUALIZADA";
  verificadaEm: string | null;
  servicos: { nfe: EstadoServicoDashboardFiscal; nfce: EstadoServicoDashboardFiscal; verificadosEm: string | null };
  certificado: CertificadoDashboardFiscal;
  evidenciaPainel?: { origem: "PAINEL_BRASIL_NFE" | "RELATO_USUARIO_PAINEL_BRASIL_NFE"; observadoEm: string; servicoNfeNfceAtivo: boolean; certificadoValidade: string | null };
  emissaoHabilitada: boolean;
  emissaoManual?: { nfe: boolean; nfce: boolean; atualizadaEm: string | null };
};
/** Projeção pública: sem XML, payload comercial, credenciais ou erros externos. */
export type DashboardFiscalDto = {
  filtros: FiltrosDashboardFiscal;
  regimeFiscal?: RegimeFiscalEmpresaBrasilNfe;
  emitente: { nome: string | null; cnpj: string | null };
  metricas: {
    faturamento: MetricaDashboardFiscal;
    entradas: MetricaDashboardFiscal;
    canceladas: MetricaDashboardFiscal;
    ticketMedio: MetricaDashboardFiscal;
  };
  movimentoDiario: { dia: string; saidas: string | null; entradas: string | null }[];
  receitaPorDocumento: { modelo: 55 | 65; valor: string | null; quantidade: number }[];
  ultimosDocumentos: DocumentoDashboardFiscal[];
  documentosPorTipo?: Record<TipoDocumentoDashboardFiscal, number>;
  pendencias: PendenciaDashboardFiscal[];
  integracao: IntegracaoDashboardFiscal;
  links: { grupos: string | null; vinculos: string | null; notasRecebidas: string | null; configuracao: string | null };
  avisos: string[];
};
