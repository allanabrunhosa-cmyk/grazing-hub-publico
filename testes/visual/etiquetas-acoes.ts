import type { DadosEtiqueta, EntradaPrepararEtiqueta } from "@/lib/etiquetas/tipos";
import { gerarZplEtiqueta } from "@/lib/etiquetas/zpl";
// Dados fictícios. Não acessa banco, contas reais, SDK ou dispositivo.
export async function prepararEtiquetaAction(entrada: EntradaPrepararEtiqueta) {
  const dados: DadosEtiqueta = { produtoNome: "Salame fatiado", lojaNome: "Grazing Table & Co", lojaCnpj: "34.599.471/0001-80", lojaEndereco: "Av. Doutor Cardoso de Melo, 973, São Paulo, SP", conservacao: entrada.conservacao, quantidade: entrada.quantidade || null, unidade: "KG", lote: entrada.lote || null, marcaFornecedor: entrada.marcaFornecedor || "Aurora", sif: entrada.sif || null, validadeOriginal: entrada.validadeOriginal || null, codigoRastreio: "000000", responsavelManipulacao: entrada.responsavelManipulacao, manipuladoEm: "2026-09-16T12:00:00Z", validoAte: "2026-10-01T12:00:00Z", fusoHorario: "America/Sao_Paulo", resolucaoDpi: 203, tamanho: entrada.tamanho, mostrarHora: entrada.mostrarHora, copias: entrada.copias };
  return { ok: true as const, trabalho: { id: "somente-previa", zpl: gerarZplEtiqueta(dados), nomeArquivo: "teste.zpl", dados, status: "PREPARADO", reutilizado: false } };
}
export async function registrarExportacaoEtiquetaAction() { return { ok: true as const }; }
export async function confirmarImpressaoEtiquetaAction() { return { erro: "Impressão física não validada nesta prévia." }; }
export async function iniciarEnvioEtiquetaAction() { return { erro: "Prévia sem acesso a equipamento." }; }
export async function finalizarTentativaEtiquetaAction() { return { erro: "Prévia sem acesso a equipamento." }; }
export async function salvarConfiguracaoImpressoraAction() { return { erro: "Prévia: nenhuma alteração será salva." }; }
export async function salvarConfiguracaoProdutoEtiquetaAction() { return { erro: "Prévia: nenhuma alteração será salva." }; }
