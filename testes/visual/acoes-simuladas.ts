import JSZip from "jszip";
import { extrairCustosNFe } from "@/lib/sefaz/custosNFe";
import { xmlCustos } from "../notas-fiscais/custos-dados";
import { detalhesTeste, itemTeste } from "../notas-fiscais/dados";
import { compraFicticia } from "./cancelamento-compra-dados";
export async function obterResumoCancelamentoNotaAction() { return { resumo: new URLSearchParams(location.search).has("reversao") ? compraFicticia : null }; }

// Exclusivo do servidor visual de testes. Este módulo nunca é importado pelo Next.
export async function obterItensNotaFiscalAction() { return { ...detalhesTeste, ...(new URLSearchParams(location.search).has("custos") ? {
  custos: extrairCustosNFe(xmlCustos),
  itens: [{ ...itemTeste, valorTotalItem: 100 }, { ...itemTeste, id: "item-dois", numeroItem: 2, descricaoProduto: "Queijo curado artesanal", valorTotalItem: 300 }],
  duplicatas: [{ ...detalhesTeste.duplicatas[0], valor: 445 }],
} : {}), detalhes: { naturezaOperacao: "Venda de mercadoria", modelo: "55", serie: "1", numero: "12345", codigoUnico: "000001", versao: "4.00", emitenteCnpj: "00000000000000", emitenteNome: "Laticínios Serra Comércio de Alimentos Ltda.", emitenteEndereco: { logradouro: "Rua das Flores", numero: "100", bairro: "Centro", municipio: "São Paulo", uf: "SP" }, fornecedorCadastrado: null } }; }
export async function obterInsumoOptionAction() { return null; }
export async function importarXmlNotaAction() { return { ok: true }; }
export async function importarXmlAvulsoAction() { return { mensagem: "XML importado na prévia simulada." }; }
export async function exportarXmlPorDataAction() {
  if (new URLSearchParams(location.search).has("erroExportacao")) throw new Error("Falha simulada");
  const zip = new JSZip();
  zip.file("nota-ficticia.xml", '<teste>Prévia de exportação, sem valor fiscal.</teste>');
  return { nomeArquivo: "notas-ficticias.zip", conteudoBase64: await zip.generateAsync({ type: "base64" }), quantidade: 1, semXml: 2 };
}
export async function confirmarConciliacaoNotaAction() { return { ok: true, movimentacoesCriadas: 1 }; }
export async function manifestarAction() {
  return new URLSearchParams(location.search).has("erro")
    ? { sucesso: false, mensagem: "Object reference not set to an instance of an object (simulado)", protocolo: null }
    : { sucesso: true, mensagem: "Envio simulado para teste visual", protocolo: "TESTE" };
}

export async function aceitarNotaAction() { return new URLSearchParams(location.search).has("erro") ? { erro: "Falha simulada na SEFAZ" } : { ok: true }; }
export async function criarLancamentoAction() { return { ok: true }; }
export async function atualizarLancamentoAction() { return { ok: true }; }
export async function excluirLancamentoAction() { return { ok: true, quantidade: 1 }; }
export async function obterResumoExclusaoLancamentoAction() {
  if (new URLSearchParams(location.search).has("reversao")) return { descricao: compraFicticia.descricao, grupo: null, pendentes: 8, realizados: 0, compra: compraFicticia };
  return { descricao: "Aluguel da cozinha (2/5)", grupo: "RECORRENCIA" as const, pendentes: 4, realizados: 1 };
}
export async function estornarBaixaLancamentoAction() { return { ok: true }; }
export async function baixarLancamentoAction() { return { ok: true }; }
export async function prepararExtratoAction() { return { erro: "Ação indisponível na prévia visual." }; }
export async function importarExtratoAction() { return { erro: "Ação indisponível na prévia visual." }; }
export async function conciliarExtratoAction() { return { ok: true }; }
export async function desfazerConciliacaoAction() { return { ok: true }; }
export async function salvarItemContagemAction() { return { ok: true }; }
export async function finalizarContagemAction() { return { ajustes: 0 }; }
export async function excluirContagemAction() { return { ok: true }; }
export async function deleteFornecedorAction() { return { ok: true }; }
export async function deleteInsumoAction() { return { error: null }; }
export async function saveInsumoAction() { return { error: "Cadastro indisponível nesta prévia visual." }; }
export async function saveFornecedorAction() { return { error: null }; }
export async function salvarBeneficiarioAction() { return { ok: true }; }
export async function excluirBeneficiarioAction() { return { ok: true }; }
export async function createCanalPedidoAction() { return { id: "canal-simulado", nome: "Canal simulado" }; }
export async function createFormaPagamentoAction() { return { id: "forma-simulada", nome: "Forma simulada" }; }
export async function logoutAction() {}
