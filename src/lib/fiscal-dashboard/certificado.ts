import type { CertificadoDashboardFiscal } from "./tipos";

/** Resume somente a validade persistida; não acessa nem valida o conteúdo do certificado. */
export function resumirCertificadoDashboard(registro: { validoAte: Date | null } | null, agora: Date): CertificadoDashboardFiscal {
  const validade = registro?.validoAte;
  const vencimento = validade instanceof Date ? validade.getTime() : NaN;
  const instanteAtual = agora instanceof Date ? agora.getTime() : NaN;
  if (!Number.isFinite(vencimento) || !Number.isFinite(instanteAtual)) {
    return { situacao: "NAO_VERIFICADO", validoAte: null, diasParaVencer: null };
  }
  // Conserva o arredondamento de Dados da empresa, normalizando -0 para o DTO.
  const diasParaVencer = Math.ceil((vencimento - instanteAtual) / 86400000) || 0;
  return {
    situacao: vencimento <= instanteAtual ? "VENCIDO" : diasParaVencer <= 30 ? "A_VENCER" : "VIGENTE",
    validoAte: validade!.toISOString(),
    diasParaVencer,
  };
}
