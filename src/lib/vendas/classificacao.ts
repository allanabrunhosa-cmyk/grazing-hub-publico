/** Compatibilidade de leitura. Papéis antigos não criam uma terceira classificação. */
export function classificacaoComercial(p: { classificacoes?: string[]; classificacao?: string }): "PRINCIPAL" | "COMPLEMENTO" {
  const papeis = p.classificacoes?.length ? p.classificacoes : [p.classificacao ?? "PRINCIPAL"];
  return papeis.includes("PRINCIPAL") ? "PRINCIPAL" : "COMPLEMENTO";
}

export const CORES_CATEGORIA = { azul: "Azul", verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho" } as const;
export type CorCategoria = keyof typeof CORES_CATEGORIA;
export type EscopoCategoria = "PRODUTO" | "COMPLEMENTO";
