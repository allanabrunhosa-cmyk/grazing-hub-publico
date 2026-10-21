type CategoriaComPai = { nome: string; pai?: CategoriaComPai | null };

/** Rótulo completo para distinguir nomes iguais em ramos diferentes. */
export function caminhoCategoria(categoria: CategoriaComPai): string {
  return categoria.pai ? `${caminhoCategoria(categoria.pai)} › ${categoria.nome}` : categoria.nome;
}

export function categoriasComCaminho<T extends CategoriaComPai>(categorias: T[]): T[] {
  return categorias.map((categoria) => ({ ...categoria, nome: caminhoCategoria(categoria) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// O plano permite categoria, subcategoria e subdivisão.
export const SELECAO_CATEGORIA_COM_CAMINHO = {
  id: true, nome: true, grupo: true,
  pai: { select: { nome: true, pai: { select: { nome: true } } } },
} as const;
