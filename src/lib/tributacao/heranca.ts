/** Grupo é sugestão operacional. Identidade/unidade fiscal e valores individuais não são
 * propagados em lote nem substituídos por parâmetros genéricos. */
export function herdarParametrosFiscais(modelo: Record<string, string>, individual: Record<string, string>) {
  const r = { ...individual };
  for (const [campo, valor] of Object.entries(modelo)) if (!["ncm", "origem", "cest", "ean", "unidadeTributavel"].includes(campo) && !r[campo] && valor) r[campo] = valor;
  return r;
}
