import type { CelulaPlanilha, LinhaGrupoPlanilha, PlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { periodoDoMes } from "@/lib/financeiro/periodos";

function mesDaData(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const mes = periodoDoMes(data.slice(0, 7));
  return mes && data >= mes.de && data <= mes.ate ? mes : null;
}

/** Estende os limites ao mês inteiro sem transformar um intervalo invertido em válido. */
export function completarMesesFluxoCaixa(periodo: { de: string; ate: string }): { de: string; ate: string } {
  const mesInicial = mesDaData(periodo.de);
  const mesFinal = mesDaData(periodo.ate);
  if (mesInicial && mesFinal && periodo.de > periodo.ate) return { ...periodo };
  return { de: mesInicial?.de ?? periodo.de, ate: mesFinal?.ate ?? periodo.ate };
}

/**
 * Mantém o contrato da planilha. Cada chave de dia passa a representar o fechamento
 * mensal, identificado pelo último dia do mês. Calcule a origem com meses inteiros.
 * O saldo usa o último dia disponível de cada mês; saldos diários nunca são somados.
 */
export function consolidarPlanilhaFluxoCaixaPorMes(planilha: PlanilhaFluxoCaixa): PlanilhaFluxoCaixa {
  const fechamentoPorDia = new Map<string, string>();
  const diasPorMes = new Map<string, string[]>();
  for (const dia of planilha.dias) {
    const mes = mesDaData(dia);
    if (!mes) continue;
    fechamentoPorDia.set(dia, mes.ate);
    const dias = diasPorMes.get(mes.ate) ?? [];
    dias.push(dia);
    diasPorMes.set(mes.ate, dias);
  }

  function consolidarCelulas(porDia: Record<string, CelulaPlanilha>): Record<string, CelulaPlanilha> {
    const porMes: Record<string, CelulaPlanilha> = {};
    for (const [dia, celula] of Object.entries(porDia)) {
      const fechamento = fechamentoPorDia.get(dia);
      if (!fechamento) continue;
      const atual = porMes[fechamento] ?? { valor: 0, lancamentoIds: [], temPendente: false };
      atual.valor += Math.round(celula.valor * 100);
      atual.lancamentoIds.push(...celula.lancamentoIds);
      atual.temPendente ||= celula.temPendente;
      porMes[fechamento] = atual;
    }
    for (const celula of Object.values(porMes)) celula.valor /= 100;
    return porMes;
  }

  function consolidarGrupos(grupos: LinhaGrupoPlanilha[]): LinhaGrupoPlanilha[] {
    return grupos.map(grupo => ({
      ...grupo,
      porDia: consolidarCelulas(grupo.porDia),
      categorias: grupo.categorias.map(categoria => ({ ...categoria, porDia: consolidarCelulas(categoria.porDia) })),
    }));
  }

  function consolidarTotais(porDia: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Array.from(diasPorMes, ([fechamento, dias]) => [
      fechamento,
      dias.reduce((soma, dia) => soma + Math.round((porDia[dia] ?? 0) * 100), 0) / 100,
    ]));
  }

  const saldoPorDia = Object.fromEntries(Array.from(diasPorMes, ([fechamento, dias]) => {
    const ultimoDia = dias.reduce((ultimo, dia) => dia > ultimo ? dia : ultimo);
    return [fechamento, planilha.saldoPorDia[ultimoDia]];
  }));

  return {
    ...planilha,
    dias: Array.from(diasPorMes.keys()),
    receitas: consolidarGrupos(planilha.receitas),
    despesas: consolidarGrupos(planilha.despesas),
    totalReceitasPorDia: consolidarTotais(planilha.totalReceitasPorDia),
    totalDespesasPorDia: consolidarTotais(planilha.totalDespesasPorDia),
    saldoPorDia,
  };
}
