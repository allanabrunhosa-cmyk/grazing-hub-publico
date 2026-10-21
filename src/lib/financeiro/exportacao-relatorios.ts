import type { ResultadoDre, ModoDre } from "./calcularDre";
import { calcularResultadoFluxoCaixa, montarArvoreFluxoCaixa, type PlanilhaFluxoCaixa, type NoCategoriaFluxo } from "./fluxoCaixa";
import type { LancamentoRow } from "@/app/(protegido)/financeiro/types";

export type LinhaRelatorio = { nome: string; nivel: number; valores: number[]; pendentes?: boolean[] };
export type RelatorioFinanceiro = {
  titulo: string;
  arquivo: string;
  filtros: string;
  colunas: string[];
  linhas: LinhaRelatorio[];
  agrupamentoFluxo?: "diario" | "mensal";
  detalhes?: { dia: string; categoria: string; descricao: string; status: string; valor: number }[];
};

export function dataRelatorio(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

function filtroPeriodo(de: string, ate: string) {
  return `Período: ${de ? dataRelatorio(de) : "sem limite inicial"} a ${ate ? dataRelatorio(ate) : "sem limite final"}`;
}

export function montarExportacaoDre(resultado: ResultadoDre, de: string, ate: string, modo: ModoDre): RelatorioFinanceiro {
  const linhas: LinhaRelatorio[] = [];
  function grupo(chave: keyof ResultadoDre["grupos"], nome: string, deducao = false) {
    const g = resultado.grupos[chave];
    linhas.push({ nome: `${deducao ? "(-) " : ""}${nome}`, nivel: 0, valores: [g.total] });
    for (const c of g.categorias) linhas.push({ nome: c.nome, nivel: 1, valores: [c.valor] });
  }
  function total(nome: string, valor: number) { linhas.push({ nome, nivel: 0, valores: [valor] }); }
  grupo("RECEITA_BRUTA", "Faturamento Bruto");
  grupo("DEDUCOES_RECEITA", "Deduções de Receita", true);
  total("Faturamento Líquido", resultado.faturamentoLiquido);
  grupo("CMV", "CMV", true);
  grupo("DESPESAS_VARIAVEIS", "Despesas Variáveis", true);
  total("Margem de Contribuição", resultado.margemContribuicao);
  grupo("FOLHA_PAGAMENTO", "Despesas com pessoal", true);
  grupo("DESPESAS_OPERACIONAIS", "Despesas Operacionais", true);
  total("Lucro Operacional Antes dos Investimentos (LOAI)", resultado.loai);
  grupo("INVESTIMENTOS", "Investimentos", true);
  total("Lucro Operacional (EBITDA)", resultado.ebitda);
  grupo("DESPESAS_FINANCEIRAS", "Despesas Financeiras", true);
  grupo("RECEITAS_NAO_OPERACIONAIS", resultado.grupos.RECEITAS_NAO_OPERACIONAIS.label);
  grupo("DEPRECIACAO_AMORTIZACAO", "Depreciação e Amortização", true);
  grupo("DESPESAS_NAO_OPERACIONAIS", "Despesas Não Operacionais", true);
  total("Resultado Líquido", resultado.resultadoLiquido);
  return { titulo: "DRE", arquivo: `dre-${modo.toLowerCase()}-${de || "inicio"}-${ate || "fim"}`,
    filtros: `${filtroPeriodo(de, ate)} | ${modo === "CAIXA" ? "Caixa" : "Competência"}`,
    colunas: ["Valor (R$)"], linhas };
}

export function montarExportacaoFluxo(planilha: PlanilhaFluxoCaixa, lancamentos: LancamentoRow[], de: string, ate: string, agrupamento: "diario" | "mensal" = "diario"): RelatorioFinanceiro {
  const linhas: LinhaRelatorio[] = [];
  const mensal = agrupamento === "mensal";
  function incluirTotal<T>(valores: T[], total: T): T[] {
    return mensal ? valores : [...valores, total];
  }
  function categoria(no: NoCategoriaFluxo, nivel: number) {
    const sinal = no.tipo === "DESPESA" ? -1 : 1;
    linhas.push({ nome: no.categoriaNome, nivel,
      valores: incluirTotal(planilha.dias.map(d => sinal * (no.porDia[d]?.valor ?? 0)), sinal * no.total),
      pendentes: incluirTotal(planilha.dias.map(d => no.porDia[d]?.temPendente ?? false), Object.values(no.porDia).some(c => c.temPendente)) });
    no.filhos.forEach(filho => categoria(filho, nivel + 1));
  }
  for (const [grupos, nome, totais, total, sinal] of [
    [planilha.receitas, "Receitas", planilha.totalReceitasPorDia, planilha.totalReceitasGeral, 1],
    [planilha.despesas, "Despesas", planilha.totalDespesasPorDia, planilha.totalDespesasGeral, -1],
  ] as const) {
    for (const g of grupos) {
      linhas.push({ nome: `${nome} / ${g.grupoLabel}`, nivel: 0,
        valores: incluirTotal(planilha.dias.map(d => sinal * (g.porDia[d]?.valor ?? 0)), sinal * g.total),
        pendentes: incluirTotal(planilha.dias.map(d => g.porDia[d]?.temPendente ?? false), Object.values(g.porDia).some(c => c.temPendente)) });
      montarArvoreFluxoCaixa(g.categorias).forEach(no => categoria(no, 1));
    }
    linhas.push({ nome: `Total de ${nome}`, nivel: 0, valores: incluirTotal(planilha.dias.map(d => sinal * totais[d]), sinal * total) });
  }
  linhas.push({ nome: mensal ? "Saldo do Mês" : "Saldo do Dia", nivel: 0, valores: incluirTotal(planilha.dias.map(d => planilha.saldoPorDia[d]), planilha.saldoFinal) });
  linhas.push({ nome: mensal ? "Resultado do Mês" : "Resultado do Dia", nivel: 0,
    valores: incluirTotal(planilha.dias.map(d => calcularResultadoFluxoCaixa(planilha.totalReceitasPorDia[d] ?? 0, planilha.totalDespesasPorDia[d] ?? 0)),
      calcularResultadoFluxoCaixa(planilha.totalReceitasGeral, planilha.totalDespesasGeral)) });
  // Evita a apresentação de -0,00 em categorias de despesa sem atividade.
  linhas.forEach(l => { l.valores = l.valores.map(v => v === 0 ? 0 : v); });
  // Os IDs vêm das células já filtradas: inclui projeções e exclui crédito de carteira,
  // sem refazer a seleção por datas nem incorporar o histórico que compõe o saldo.
  const porId = new Map(lancamentos.map(l => [l.id, l]));
  const detalhes: NonNullable<RelatorioFinanceiro["detalhes"]> = [];
  for (const dia of planilha.dias) {
    const ids = new Set([...planilha.receitas, ...planilha.despesas].flatMap(g => g.porDia[dia]?.lancamentoIds ?? []));
    for (const id of ids) {
      const l = porId.get(id);
      if (l) detalhes.push({ dia: mensal ? ((l.status === "BAIXADO" ? l.dataPagamento : null) ?? l.dataVencimento).slice(0, 10) : dia,
        categoria: l.categoriaNome, descricao: l.descricao,
        status: l.status === "BAIXADO" ? "Baixado" : "Pendente (projeção)", valor: l.tipo === "DESPESA" ? -l.valor : l.valor });
    }
  }
  return { titulo: "Fluxo de Caixa", arquivo: `fluxo-de-caixa-${mensal ? "mensal-" : ""}${de || "inicio"}-${ate || "fim"}`,
    filtros: `${filtroPeriodo(de, ate)}${mensal ? " | Agrupamento: Mensal" : ""}`, agrupamentoFluxo: agrupamento,
    colunas: incluirTotal(planilha.dias.map(d => mensal ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : dataRelatorio(d)), "Total do período"), linhas, detalhes };
}
