/** Referência de navegação somente leitura; não identifica autor nem concede acesso. */
export function entidadeInicial(valor: unknown): string | undefined {
  return typeof valor === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(valor) ? valor : undefined;
}
