import type { MetadadosErroBrasilNfe } from "./diagnostico-http";
import type { NumeracoesBrasilNfeSanitizadas } from "./tipos-http";

export type NumeracaoFiscalBrasilNfeDto = {
  versaoConfiguracao: number;
  emitente: { cnpj: string | null; nome: string | null };
  consulta: { situacao: "NAO_CONSULTADA" | "CONCLUIDA" | "FALHOU" | "OBSOLETA"; consultadoEm: string | null; httpStatus: number | null; falha: MetadadosErroBrasilNfe | null; avisosPresentes: boolean; itensForaEscopo?: number };
  linhas: (Omit<NumeracoesBrasilNfeSanitizadas["numeracoes"][number], "numero"> & {
    proximoNumero: string;
    ultimaAutorizadaLocal: { documentoId: string; numero: string; autorizadaEm: string | null } | null;
    divergencia: "CONTADOR_NAO_SUPERA_AUTORIZADA_LOCAL" | null;
  })[];
  pendencias: string[];
  atualizacao?: AtualizacaoNumeracaoBrasilNfeDto | null;
  historicoAtualizacoes?: AtualizacaoNumeracaoBrasilNfeDto[];
};

export type ComandoAtualizacaoNumeracaoBrasilNfe = {
  versao: number; modelo: 55 | 65; ambiente: 1 | 2; serie: string; proximoNumero: string;
  padrao: boolean; operacaoId: string; consultadoEm: string; confirmarAtualizacao: true;
};
export type RequisicaoAtualizacaoNumeracaoBrasilNfeHttp = {
  TipoAmbiente: 1 | 2; ModeloDocumento: 55 | 65; Serie: string; Numero: number; Padrao: boolean;
};
export type AtualizacaoNumeracaoBrasilNfeDto = {
  situacao: "EM_ANDAMENTO" | "CONFIRMADA" | "PENDENTE_CONFERENCIA" | "RECUSADA";
  contexto?: "ATUAL" | "ANTERIOR";
  operacaoId: string; solicitadoEm: string; confirmadoEm: string | null;
  modelo: 55 | 65; ambiente: 1 | 2; serie: string; proximoNumero: string; padrao: boolean;
  falha: MetadadosErroBrasilNfe | null; motivo: string | null;
};

export const MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE = Object.freeze({
  CONFIRMADA: "Atualização confirmada por consulta posterior do mesmo emitente.",
  JA_CONFIGURADA: "A consulta recente já confirmou a configuração solicitada. Nenhuma atualização foi enviada.",
  IDENTIDADE_DIVERGENTE: "O emitente consultado não corresponde ao cadastro do HUB. Nenhuma atualização foi enviada.",
  REDUCAO: "O próximo número não pode reduzir o contador nem repetir um número de documento local.",
  NOVA_SERIE: "Série inexistente no fornecedor só pode ser criada no número 1 e sem documentos locais na sequência.",
  DOCUMENTO_EM_ANDAMENTO: "Há documento fiscal com processamento ou resultado pendente. Confira-o antes de administrar a numeração.",
  HISTORICO_LOCAL_INCOMPLETO: "O histórico local não comprova a identidade ou a série de um documento consumido. Nenhuma atualização foi enviada.",
  FALHA_PRE_CONSULTA: "A conferência anterior não foi concluída. Nenhuma atualização foi enviada.",
  CONFIGURACAO_ALTERADA: "Configuração, emitente ou permissão mudou durante a operação. Confira o histórico antes de outra ação.",
  OPERACAO_EXPIRADA: "O prazo da operação terminou antes da atualização externa. Nenhuma atualização foi enviada.",
  OPERACAO_ENCERRADA: "A operação não está mais vigente. Nenhuma atualização foi enviada por esta execução.",
  RESULTADO_INCERTO: "O resultado da atualização não foi confirmado. Faça uma consulta manual antes de qualquer nova solicitação.",
  NEGADA_FORNECEDOR: "O endpoint de atualização informou status false. A alteração foi recusada; nenhuma repetição foi executada.",
  POS_CONSULTA_DIVERGENTE: "A consulta posterior não confirmou integralmente a atualização. Confira a numeração antes de outra ação.",
  CONSULTA_CONFIRMOU: "A consulta manual posterior confirmou a configuração solicitada.",
  CONSULTA_NAO_CONFIRMOU: "O resultado anterior não foi confirmado. A operação permanece pendente; não repita a atualização.",
  CONSULTA_SEM_ENVIO: "A tentativa foi encerrada por consulta manual sem registro de intenção de atualização externa.",
} as const);

export type RegistroNumeracaoBrasilNfe = {
  esquema: "grazing.brasilnfe.numeracao";
  versao: 1;
  versaoConfiguracao: number;
  emitenteHash: string;
  consultadoEm: string;
  resultado: NumeracoesBrasilNfeSanitizadas | null;
  falha: MetadadosErroBrasilNfe | null;
};
