const resposta = async () => new URLSearchParams(location.search).has("erro") ? { erro: "Falha simulada: preenchimento preservado." } : { ok: true, id: "teste" };
export const saveInsumoAction = async () => ({ error: "Cadastro de insumo desabilitado na prévia." });
export const salvarClienteVendaAction = resposta;
export const salvarFormaPagamentoVendaAction = resposta;
export const salvarCategoriaVendaAction = async (d: Record<string, unknown>) => ({ ok: true, id: "nova-categoria", registro: { ...d, id: "nova-categoria", versao: 1, ordem: 2, produtos: [] } });
export const salvarGrupoVendaAction = async (d: { id: string; opcoes: Record<string, unknown>[] }) => ({ ok: true, id: d.id || "novo-grupo", registro: { ...d, id: d.id || "novo-grupo", versao: 1, produtos: [], opcoes: d.opcoes.map((o, i) => ({ ...o, id: o.id || `nova-opcao-${i}`, grupoId: d.id || "novo-grupo", ordem: i })) } });
export const salvarProdutoVendaAction = resposta;
export const salvarTipoEmbalagemAction = async () => ({ erro: "Cadastro de embalagem desabilitado na prévia visual." });
export const alterarSituacaoProdutoVendaAction = resposta;
export const alterarPrecoProdutoVendaAction = async (_id: string, versao: number) => ({ ...await resposta(), versao: versao + 1 });
export const criarCanalVendaAction = resposta;
export const salvarCanalVendaAction = resposta;
export const excluirCadastroVendaAction = resposta;
export const salvarCategoriaGrupoVendaAction = resposta;
export const salvarGrupoFiscalVendaAction = resposta;
export const enviarFotoProdutoVendaAction = async () => ({ erro: "Envio de foto desabilitado na prévia isolada." });
export const salvarFiscalVendaAction = resposta;
export const reordenarCategoriasVendaAction = resposta;
export const reordenarProdutosVendaAction = resposta;
export const prepararImportacaoVendaAction = async (conteudo: string) => {
  const pacote = JSON.parse(conteudo);
  return { previa: { pacote, token: "a".repeat(64), contagens: { novos: 1, atualizar: 0, manter: 0, conflitos: 1 }, linhas: [
    { entidade: "PRODUTO", chave: "novo", nome: "Produto de demonstração", situacao: "NOVO", motivo: "Novo produto inativo para conferência.", destinoId: null, versao: null, resumo: "" },
    { entidade: "PRODUTO", chave: "conflito", nome: "Edição local preservada", situacao: "CONFLITO", motivo: "Origem e cadastro local mudaram. Nenhuma sobrescrita automática.", destinoId: "p1", versao: 2, resumo: "" },
  ] } };
};
export const aplicarImportacaoVendaAction = async () => new URLSearchParams(location.search).has("erro") ? { erro: "O catálogo mudou depois da prévia. Confira novamente." } : { resultado: { aplicados: 1, manter: 0, conflitos: 1 } };
export async function alterarStatusCadastroVendaAction(_tipo: string, _id: string, versao: number, ativo: boolean) { return new URLSearchParams(location.search).has("erro") ? { erro: "Falha simulada na alteração de status." } : { ok: true as const, versao: versao + 1, ativo }; }
