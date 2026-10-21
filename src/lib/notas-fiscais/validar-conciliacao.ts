import type { ItemConciliacaoInput, DuplicataInput } from "@/app/(protegido)/notas-fiscais/actions";
import { validarDataEntradaEstoque } from "./data-entrada";

import type { DistribuicaoDesconto } from "./custos";

export type EntradaConciliacao = {
  distribuicaoDesconto?: DistribuicaoDesconto;
  notaFiscalId: string;
  localId: string;
  dataEntradaEstoque?: string;
  itens: ItemConciliacaoInput[];
  duplicatas: DuplicataInput[];
};

export function validarConciliacao(entrada: EntradaConciliacao): string | null {
  if (entrada.itens.some(item => item.acao === "CONCILIAR" && item.destino === "ESTOQUE")) {
    const validacao = validarDataEntradaEstoque(entrada.dataEntradaEstoque);
    if ("erro" in validacao) return validacao.erro;
  }
  const identificadores = new Set<string>();
  for (const item of entrada.itens) {
    if (identificadores.has(item.notaFiscalItemId)) return "Há itens repetidos na conciliação. Reabra a nota.";
    identificadores.add(item.notaFiscalItemId);
    if (item.acao !== "CONCILIAR") return "Preencha todos os itens antes de aceitar a nota.";
    if (!Number.isFinite(item.valorTotal) || item.valorTotal < 0) return "Informe o valor total de cada item.";
    if (item.destino === "ESTOQUE") {
      if (!entrada.localId || !item.insumoId) return "Selecione o local e um insumo para cada item de estoque.";
      if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) return "Informe uma quantidade maior que zero para cada item de estoque.";
      if (item.modoCusto !== "MEDIA" && item.modoCusto !== "NOVO") return "Selecione o modo de cálculo do custo.";
    } else if (item.destino !== "USO_E_CONSUMO" || !item.categoriaFinanceiraId) {
      return "Selecione uma categoria financeira para cada item de uso e consumo.";
    }
  }
  if (entrada.itens.length && !entrada.duplicatas.length) return "Informe ao menos uma parcela (duplicata) válida.";
  const parcelas = new Set<string>();
  for (const parcela of entrada.duplicatas) {
    const data = new Date(`${parcela.dataVencimento}T12:00:00Z`);
    if (!parcela.numero.trim() || !Number.isFinite(parcela.valor) || parcela.valor <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parcela.dataVencimento) || !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== parcela.dataVencimento) {
      return "Preencha número, vencimento e valor válido em todas as parcelas.";
    }
    if (parcela.id && parcelas.has(parcela.id)) return "Há parcelas repetidas. Reabra a nota.";
    if (parcela.id) parcelas.add(parcela.id);
  }
  return null;
}
