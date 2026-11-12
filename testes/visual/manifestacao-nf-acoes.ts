import type { ItemConciliacaoRow } from "@/app/(protegido)/notas-fiscais/types";
import type { CustosNotaFiscal, DetalhamentoTributos } from "@/lib/notas-fiscais/custos";

// Fronteira exclusiva da prévia: não importa ações Next nem acessa serviços fiscais.
export function registrarChamada(acao: string, entrada: unknown) {
  window.dispatchEvent(new CustomEvent("manifestacao-nf-fixture", { detail: { acao, entrada } }));
}

async function resultadoSimulado(acao: string, entrada: unknown) {
  registrarChamada(acao, entrada);
  const parametros = new URLSearchParams(location.search);
  if (parametros.has("pendente")) await new Promise<never>(() => {});
  if (parametros.has("erro")) return { erro: "Falha simulada. Os dados permanecem no formulário." };
  return { ok: true, sucesso: true };
}

export async function obterItensNotaFiscalAction(notaFiscalId: string) {
  const comDesconto = notaFiscalId === "desconto";
  const consumo = notaFiscalId === "consumo" || comDesconto;
  const item: ItemConciliacaoRow = {
    id: `item-${notaFiscalId}`, numeroItem: 1, codigoProdutoFornecedor: "FICTICIO-01",
    descricaoProduto: comDesconto ? "Produto com desconto de exemplo" : consumo ? "Material de uso e consumo de exemplo" : "Equipamento devolvido de exemplo",
    codigoEan: null, ncm: null, unidadeComercial: "UN", quantidadeComercial: 1,
    valorUnitarioComercial: 100, valorTotalItem: 100,
    status: "PENDENTE", destino: consumo ? "USO_E_CONSUMO" : "ESTOQUE",
    insumoId: consumo ? null : "insumo-visual", insumoNome: consumo ? null : "Item de exemplo",
    categoriaFinanceiraId: consumo ? "categoria-visual" : null,
    categoriaFinanceiraNome: consumo ? "Material de consumo" : null,
    quantidadeConciliada: null, valorTotalConciliado: null,
  };
  const tributos: DetalhamentoTributos = { icmsIncluso: 0, fcpIncluso: 0, pisIncluso: 0, cofinsIncluso: 0, icmsSt: 0, icmsMonofasicoRetido: 0, fcpSt: 0, impostoImportacao: 0, pisSt: 0, cofinsSt: 0, ipiDevolvido: 0 };
  const custo = { produtos: 100, frete: 0, ipi: 0, seguro: 0, outrasDespesas: 0, outrosTributos: 0, abatimentos: 0, desconto: 10, tributos };
  const custos: CustosNotaFiscal | null = comDesconto ? { ...custo, itens: [{ ...custo, numeroItem: 1 }], totalNota: 90 } : null;
  return {
    itens: [item], custos, cartoes: [],
    duplicatas: [{ id: `parcela-${notaFiscalId}`, numero: "001", dataVencimento: "2026-11-20", valor: comDesconto ? 90 : 100, formaPagamento: "BOLETO" as const }],
    detalhes: {
      naturezaOperacao: consumo ? "Venda de material para uso e consumo" : "Retorno de equipamento",
      modelo: "55", serie: "1", numero: "123", codigoUnico: "000001", versao: "4.00",
      emitenteCnpj: null, emitenteNome: "Fornecedor fictício da prévia",
      emitenteEndereco: { logradouro: null, numero: null, bairro: null, municipio: null, uf: null },
      fornecedorCadastrado: { id: "fornecedor-visual", nome: "Fornecedor fictício da prévia", memorizado: true },
    },
  };
}

export async function obterInsumoOptionAction() { return null; }
export async function obterResumoCancelamentoNotaAction() { return { erro: "Recusa fiscal fora do escopo desta prévia." }; }
export async function aceitarNotaAction(entrada: unknown) { return resultadoSimulado("ACEITAR_NFE", entrada); }
export async function tratarOutraOperacaoNotaAction(entrada: unknown) { return resultadoSimulado("TRATAR_NFE", entrada); }
export async function manifestarAction() { return { sucesso: false, mensagem: "Envio fiscal indisponível nesta prévia." }; }
export async function exportarXmlPorDataAction() { return { erro: "Exportação fora do escopo desta prévia." }; }
export async function importarXmlPelaApi() { return { erro: "Importação fora do escopo desta prévia." }; }
