import { calcularCustosNota, centavos, ratearValor, type ComposicaoCusto } from "./custos";
import { extrairCustosNFe } from "@/lib/sefaz/custosNFe";

export type LancamentoNotaLegada = {
  id: string;
  valor: number;
  valorDuplicata: number;
  lancamentoFinanceiro: {
    id: string;
    valor: number;
    status: string;
    dataPagamento: Date | null;
    temVinculoExtrato: boolean;
    temMovimentacaoBancaria: boolean;
  };
};

export type ItemNotaLegada = {
  id: string;
  numeroItem: number;
  status: string;
  valorTotalItem: number;
  valorTotalConciliado: number | null;
  composicaoCusto: unknown;
  lancamentos: LancamentoNotaLegada[];
};

export type NotaLegada = {
  id: string;
  chaveAcesso: string;
  fornecedorNome: string | null;
  valorTotal: number | null;
  xml: string | null;
  itens: ItemNotaLegada[];
};

export type AjusteLancamentoLegado = {
  vinculoId: string;
  lancamentoFinanceiroId: string;
  valorAnterior: number;
  valorCorrigido: number;
};

export type AjusteItemLegado = {
  itemId: string;
  numeroItem: number;
  valorAnterior: number;
  valorCorrigido: number;
  composicaoCusto: ComposicaoCusto;
  lancamentos: AjusteLancamentoLegado[];
};

export type PlanoCorrecaoNotaLegada = {
  notaId: string;
  chaveAcesso: string;
  fornecedorNome: string | null;
  valorAnterior: number;
  valorCorrigido: number;
  itens: AjusteItemLegado[];
};

export type ResultadoPlanoNotaLegada =
  | { situacao: "IGNORAR"; motivo: string }
  | { situacao: "BLOQUEADA"; motivo: string }
  | { situacao: "CORRIGIR"; plano: PlanoCorrecaoNotaLegada };

const dinheiroIgual = (a: number, b: number) => centavos(a) === centavos(b);
const somar = (valores: number[]) => valores.reduce((total, valor) => total + centavos(valor), 0) / 100;

/**
 * Planeja uma correção estritamente limitada às despesas antigas geradas pelo valor bruto
 * dos produtos. Qualquer baixa, vínculo bancário, edição manual ou item parcial bloqueia a nota.
 */
export function planejarCorrecaoNotaLegada(nota: NotaLegada): ResultadoPlanoNotaLegada {
  if (!nota.xml || nota.valorTotal == null) return { situacao: "IGNORAR", motivo: "Nota sem XML completo ou total fiscal." };
  if (!nota.itens.length || nota.itens.some(item => item.composicaoCusto != null)) {
    return { situacao: "IGNORAR", motivo: "Nota sem itens legados pendentes de composição." };
  }
  const totalLancadoAtual = somar(nota.itens.flatMap(item => item.lancamentos.map(lancamento => lancamento.valor)));
  const totalFinanceiroAtual = somar(nota.itens.flatMap(item => item.lancamentos.map(lancamento => lancamento.lancamentoFinanceiro.valor)));
  if (dinheiroIgual(totalLancadoAtual, nota.valorTotal) && dinheiroIgual(totalFinanceiroAtual, nota.valorTotal)) {
    return { situacao: "IGNORAR", motivo: "Os lançamentos já fecham com o total fiscal." };
  }

  let custos;
  try { custos = extrairCustosNFe(nota.xml); }
  catch { return { situacao: "BLOQUEADA", motivo: "Não foi possível ler os custos do XML." }; }

  const calculado = calcularCustosNota(custos, { modo: "NOTA", itens: [] });
  if ("erro" in calculado) return { situacao: "BLOQUEADA", motivo: calculado.erro };
  if (!dinheiroIgual(calculado.total, custos.totalNota) || !dinheiroIgual(custos.totalNota, nota.valorTotal)) {
    return { situacao: "BLOQUEADA", motivo: "A composição dos itens não fecha com o total fiscal da nota." };
  }
  if (nota.itens.length !== custos.itens.length || nota.itens.some(item => !custos.itens.some(custo => custo.numeroItem === item.numeroItem))) {
    return { situacao: "BLOQUEADA", motivo: "Os itens gravados não correspondem aos itens do XML." };
  }
  if (nota.itens.some(item => item.status !== "CONCILIADO")) {
    return { situacao: "BLOQUEADA", motivo: "A nota possui item pendente ou ignorado." };
  }

  const ajustes: AjusteItemLegado[] = [];
  for (const item of nota.itens) {
    const custoXml = custos.itens.find(custo => custo.numeroItem === item.numeroItem)!;
    const composicao = calculado.itens.find(custo => custo.numeroItem === item.numeroItem)!;
    if (item.valorTotalConciliado == null || !dinheiroIgual(item.valorTotalItem, custoXml.produtos)
      || !dinheiroIgual(item.valorTotalConciliado, item.valorTotalItem)) {
      return { situacao: "BLOQUEADA", motivo: `O item ${item.numeroItem} possui valor editado manualmente.` };
    }
    if (!item.lancamentos.length || !dinheiroIgual(somar(item.lancamentos.map(lancamento => lancamento.valor)), item.valorTotalConciliado)) {
      return { situacao: "BLOQUEADA", motivo: `Os lançamentos do item ${item.numeroItem} não fecham com o valor conciliado.` };
    }
    if (composicao.total <= 0) {
      return { situacao: "BLOQUEADA", motivo: `O item ${item.numeroItem} exige remoção de lançamento e precisa de revisão manual.` };
    }
    if (item.lancamentos.some(vinculo =>
      !dinheiroIgual(vinculo.valor, vinculo.lancamentoFinanceiro.valor)
      || vinculo.lancamentoFinanceiro.status !== "PENDENTE"
      || vinculo.lancamentoFinanceiro.dataPagamento != null
      || vinculo.lancamentoFinanceiro.temVinculoExtrato
      || vinculo.lancamentoFinanceiro.temMovimentacaoBancaria
      || vinculo.valorDuplicata <= 0
    )) {
      return { situacao: "BLOQUEADA", motivo: `O item ${item.numeroItem} possui despesa baixada, vinculada ou alterada.` };
    }

    const valoresCorrigidos = ratearValor(composicao.total, item.lancamentos.map(lancamento => lancamento.valorDuplicata));
    ajustes.push({
      itemId: item.id,
      numeroItem: item.numeroItem,
      valorAnterior: item.valorTotalConciliado,
      valorCorrigido: composicao.total,
      composicaoCusto: composicao,
      lancamentos: item.lancamentos.map((lancamento, indice) => ({
        vinculoId: lancamento.id,
        lancamentoFinanceiroId: lancamento.lancamentoFinanceiro.id,
        valorAnterior: lancamento.valor,
        valorCorrigido: valoresCorrigidos[indice],
      })),
    });
  }

  const valorAnterior = somar(ajustes.flatMap(item => item.lancamentos.map(lancamento => lancamento.valorAnterior)));
  const valorCorrigido = somar(ajustes.flatMap(item => item.lancamentos.map(lancamento => lancamento.valorCorrigido)));
  if (!dinheiroIgual(valorCorrigido, nota.valorTotal)) {
    return { situacao: "BLOQUEADA", motivo: "Os lançamentos corrigidos não fecham com o total fiscal da nota." };
  }
  return {
    situacao: "CORRIGIR",
    plano: {
      notaId: nota.id,
      chaveAcesso: nota.chaveAcesso,
      fornecedorNome: nota.fornecedorNome,
      valorAnterior,
      valorCorrigido,
      itens: ajustes,
    },
  };
}
