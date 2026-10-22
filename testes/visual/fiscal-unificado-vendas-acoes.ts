export { uploadCertificadoAction, removerCertificadoAction, obterSenhaCertificadoAction } from "./fiscal-certificado-acoes";
export async function salvarGrupoFiscalVendaAction() { return { erro: "Prévia sintética: nenhum cadastro real foi alterado." }; }
export async function excluirCadastroVendaAction() { return { erro: "Prévia sintética: nenhuma exclusão real foi feita." }; }
export async function alterarStatusCadastroVendaAction() { return { erro: "Prévia sintética: nenhum estado real foi alterado." }; }
export async function alterarSituacaoProdutoVendaAction() { return { erro: "Prévia sintética: nenhum produto real foi alterado." }; }
