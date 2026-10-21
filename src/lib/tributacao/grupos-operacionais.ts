/** Categorias operacionais não substituem a classificação técnica da mercadoria. */
export const GRUPOS_OPERACIONAIS = {
  PREPARACOES: "Preparações",
  VINHOS: "Revenda Vinhos e Espumantes",
  CERVEJAS: "Revenda Cervejas",
  DESTILADOS: "Revenda Destilados",
} as const;
export type GrupoOperacional = keyof typeof GRUPOS_OPERACIONAIS;
export function grupoOperacionalFiscal(fiscal: unknown): GrupoOperacional | null {
  const valor = (fiscal as Record<string, unknown> | null)?.grupoOperacional;
  return typeof valor === "string" && Object.hasOwn(GRUPOS_OPERACIONAIS, valor) ? valor as GrupoOperacional : null;
}
export function grupoFiscalArquivado(fiscal: unknown) {
  return (fiscal as Record<string, unknown> | null)?.arquivoOperacional === "QUATRO_GRUPOS";
}
