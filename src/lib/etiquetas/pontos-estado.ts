export const COMUNICACAO_RECENTE_MS = 90_000;

export function situacaoConector(dispositivo: { vistoEm: Date | null; revogadoEm: Date | null } | null, agora = new Date()) {
  if (!dispositivo) return "NAO_VINCULADO" as const;
  if (dispositivo.revogadoEm) return "REVOGADO" as const;
  if (!dispositivo.vistoEm) return "AGUARDANDO_PRIMEIRA_COMUNICACAO" as const;
  return agora.getTime() - dispositivo.vistoEm.getTime() <= COMUNICACAO_RECENTE_MS ? "RECENTE" as const : "ATRASADA" as const;
}
