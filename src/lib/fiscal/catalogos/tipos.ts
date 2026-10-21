export const TABELAS_FISCAIS = ["ncm", "cfop", "cest", "origem", "csosn", "cstIcms", "pis", "cofins", "ipi", "cEnq", "cBenef", "cstIbsCbs", "cClassTrib", "unidadeTributavel", "pagamento"] as const;
export type TabelaFiscal = typeof TABELAS_FISCAIS[number];
export type CrtFiscal = 1 | 2 | 3 | 4 | null;
export type FiltroOperacaoFiscal = "SAIDA" | "INTERNA" | "INTERESTADUAL" | "EXTERIOR" | "ENTRADA" | "TODAS";
export type OpcaoFiscal = { codigo: string; descricao: string; detalhe?: string; vigente: boolean };
export type ConsultaTabelaFiscal = { tabela: TabelaFiscal; busca?: string; selecionado?: string; dia?: string; crt?: CrtFiscal; ncm?: string; cst?: string; uf?: string; modelo?: 55 | 65; operacao?: FiltroOperacaoFiscal; ipi?: string; uso?: "EMISSAO" | "PARAMETRO_INTERNO" };
export type ResultadoTabelaFiscal = { tabela: TabelaFiscal; versao: string; fonte: string; sha256Origem: string; obtidoEm: string; opcoes: OpcaoFiscal[]; selecionado: OpcaoFiscal | null; total: number; limite: number; aviso?: string };
export function hojeFiscalCivil() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
