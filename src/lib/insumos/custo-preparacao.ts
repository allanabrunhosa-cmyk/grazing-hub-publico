import type { UnidadeMedida } from "@/generated/prisma/browser";
import { fatorDaUnidade, type ConversaoInsumo } from "@/lib/insumos/conversoes";

export type ItemCustoPreparacao = {
  id: string;
  tipo: "INSUMO" | "PRODUTO_INTERMEDIARIO";
  unidade: UnidadeMedida;
  custoMedio: number;
  rendimentoQuantidade: number | null;
  rendimentoUnidade: UnidadeMedida | null;
  conversoes: ConversaoInsumo[];
  componentes: { componenteId: string; quantidade: number }[];
};

export type CustoPreparacao = { total: number; unitario: number } | { motivo: string };

function quantidadeNaUnidadePrincipal(
  quantidade: number,
  unidadeRendimento: UnidadeMedida,
  unidadePrincipal: UnidadeMedida,
  conversoes: ConversaoInsumo[],
): number | null {
  const fator = fatorDaUnidade(unidadeRendimento, unidadePrincipal, conversoes);
  if (fator != null) return quantidade * fator;
  if (unidadeRendimento === "KG" && unidadePrincipal === "G") return quantidade * 1000;
  if (unidadeRendimento === "G" && unidadePrincipal === "KG") return quantidade / 1000;
  if (unidadeRendimento === "L" && unidadePrincipal === "ML") return quantidade * 1000;
  if (unidadeRendimento === "ML" && unidadePrincipal === "L") return quantidade / 1000;
  return null;
}

export function calcularCustoReceita(
  componentes: { quantidade: number; custoUnitario: number | null }[],
  rendimentoQuantidade: number | null,
  rendimentoUnidade: UnidadeMedida | null,
  unidade: UnidadeMedida,
  conversoes: ConversaoInsumo[],
): CustoPreparacao {
  if (!componentes.length) return { motivo: "Adicione ingredientes à receita." };
  if (componentes.some((item) => !Number.isFinite(item.quantidade) || item.quantidade <= 0 || item.custoUnitario == null || !Number.isFinite(item.custoUnitario) || item.custoUnitario <= 0)) {
    return { motivo: "Informe o custo dos ingredientes para calcular a receita." };
  }
  if (!rendimentoQuantidade || !Number.isFinite(rendimentoQuantidade) || rendimentoQuantidade <= 0 || !rendimentoUnidade) {
    return { motivo: "Informe o rendimento final da receita." };
  }
  const quantidade = quantidadeNaUnidadePrincipal(rendimentoQuantidade, rendimentoUnidade, unidade, conversoes);
  if (!quantidade || !Number.isFinite(quantidade) || quantidade <= 0) {
    return { motivo: "Cadastre a conversão entre o rendimento e a unidade de controle." };
  }
  const total = componentes.reduce((soma, item) => soma + item.quantidade * item.custoUnitario!, 0);
  return { total, unitario: total / quantidade };
}

export function calcularCustosPreparacoes(itens: ItemCustoPreparacao[]): Map<string, CustoPreparacao> {
  const porId = new Map(itens.map((item) => [item.id, item]));
  const resultados = new Map<string, CustoPreparacao>();
  const emCalculo = new Set<string>();

  function calcular(id: string): CustoPreparacao {
    const salvo = resultados.get(id);
    if (salvo) return salvo;
    const item = porId.get(id);
    if (!item) return { motivo: "Ingrediente não encontrado." };
    if (item.tipo === "INSUMO") return item.custoMedio > 0 ? { total: item.custoMedio, unitario: item.custoMedio } : { motivo: "Informe o custo dos ingredientes para calcular a receita." };
    if (emCalculo.has(id)) return { motivo: "Há uma referência circular entre preparações." };
    emCalculo.add(id);
    const componentes = item.componentes.map((componente) => {
      const custo = calcular(componente.componenteId);
      return { quantidade: componente.quantidade, custoUnitario: "unitario" in custo ? custo.unitario : null };
    });
    const resultado = calcularCustoReceita(componentes, item.rendimentoQuantidade, item.rendimentoUnidade, item.unidade, item.conversoes);
    emCalculo.delete(id);
    resultados.set(id, resultado);
    return resultado;
  }

  for (const item of itens) if (item.tipo === "PRODUTO_INTERMEDIARIO") calcular(item.id);
  return resultados;
}
