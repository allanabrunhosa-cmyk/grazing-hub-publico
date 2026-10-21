type Fornecedor = { id: string; nome: string };
export function fornecedoresDoInsumo(insumo: { fornecedorPrincipalId?: string | null; fornecedorPrincipal?: Fornecedor | null; fornecedoresHomologados: Fornecedor[] }) {
  const principalId = insumo.fornecedorPrincipalId ?? insumo.fornecedorPrincipal?.id;
  const fornecedores = [...new Map([
    ...(insumo.fornecedorPrincipal ? [insumo.fornecedorPrincipal] : []),
    ...insumo.fornecedoresHomologados,
  ].map(f => [f.id,f])).values()];
  return fornecedores.sort((a,b) => Number(b.id === principalId)-Number(a.id === principalId) || a.nome.localeCompare(b.nome,"pt-BR") || a.id.localeCompare(b.id));
}
