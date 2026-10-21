import { dataParaIso } from "@/lib/financeiro/recorrencia";
import { GRUPOS_RECEITA, ORDEM_GRUPOS_DRE, grupoDreLabels } from "@/lib/labels";
import type { GrupoDre, StatusLancamento, TipoLancamento } from "@/generated/prisma/client";
import { calcularBasesSaldo, type SaldoInicialConta } from "@/lib/financeiro/saldos-iniciais";

export type LancamentoParaPlanilha = {
  semClassificacao?: boolean;
  id: string;
  tipo: TipoLancamento;
  status: StatusLancamento;
  valor: number;
  categoriaId: string;
  categoriaNome: string;
  categoriaGrupo: GrupoDre;
  dataVencimento: string; // ISO
  dataPagamento: string | null; // ISO
  contaBancariaId?: string | null;
  pedidoQuitadoCredito?: boolean;
};

export type CelulaPlanilha = { valor: number; lancamentoIds: string[]; temPendente: boolean };

export type LinhaCategoriaPlanilha = {
  categoriaId: string;
  categoriaNome: string;
  paiId?: string | null;
  tipo: TipoLancamento;
  porDia: Record<string, CelulaPlanilha>;
  total: number;
};

export type LinhaGrupoPlanilha = {
  grupo: GrupoDre | "NAO_CLASSIFICADO";
  grupoLabel: string;
  tipo: TipoLancamento;
  categorias: LinhaCategoriaPlanilha[];
  porDia: Record<string, CelulaPlanilha>;
  total: number;
};

export type PlanilhaFluxoCaixa = {
  dias: string[];
  receitas: LinhaGrupoPlanilha[];
  despesas: LinhaGrupoPlanilha[];
  totalReceitasPorDia: Record<string, number>;
  totalDespesasPorDia: Record<string, number>;
  saldoPorDia: Record<string, number>; // saldo acumulado ao final de cada dia
  totalReceitasGeral: number;
  totalDespesasGeral: number;
  saldoFinal: number;
};

/** Resultado do período, sem incluir saldos iniciais ou somar saldos acumulados. */
export function calcularResultadoFluxoCaixa(receitas: number, despesas: number): number {
  return (Math.round(receitas * 100) - Math.round(despesas * 100)) / 100;
}

// A data que "conta" pro fluxo de caixa: lançamento baixado usa a data em que o
// dinheiro de fato entrou/saiu (dataPagamento); pendente usa o vencimento (projeção).
function dataEfetiva(l: LancamentoParaPlanilha): string {
  return (l.status === "BAIXADO" ? l.dataPagamento : null) ?? l.dataVencimento;
}

function celulaVazia(): CelulaPlanilha {
  return { valor: 0, lancamentoIds: [], temPendente: false };
}

function somarNaCelula(celula: CelulaPlanilha, l: LancamentoParaPlanilha) {
  celula.valor += l.valor;
  celula.lancamentoIds.push(l.id);
  if (l.status === "PENDENTE") celula.temPendente = true;
}

// Lógica pura de agregação — monta a planilha em duas camadas (grupo do plano de
// contas > categoria) a partir dos lançamentos do período, com total por linha, por
// coluna e saldo acumulado ao final de cada dia (mistura realizado + projetado sem
// distinção visual de valor, só de estilo — quem chamou decide como destacar pendente
// vs baixado).
export function calcularPlanilhaFluxoCaixa(
  saldoInicialTotal: number,
  lancamentos: LancamentoParaPlanilha[],
  periodo: { de: string; ate: string },
  saldosIniciais?: SaldoInicialConta[],
  planoContas: { id: string; nome: string; grupo: GrupoDre; paiId?: string | null }[] = []
): PlanilhaFluxoCaixa {
  const diaChave = (iso: string) => iso.slice(0, 10);

  const dias: string[] = [];
  const cursor = new Date(`${periodo.de}T12:00:00`);
  const fim = new Date(`${periodo.ate}T12:00:00`);
  while (cursor.getTime() <= fim.getTime()) {
    dias.push(dataParaIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  lancamentos = lancamentos.filter(l => !l.pedidoQuitadoCredito);
  const noPeriodo = lancamentos.filter((l) => {
    const dia = diaChave(dataEfetiva(l));
    return dia >= periodo.de && dia <= periodo.ate;
  });

  const antesDoPeriodo = lancamentos.filter((l) => diaChave(dataEfetiva(l)) < periodo.de);
  const bases = saldosIniciais ? calcularBasesSaldo(saldosIniciais, lancamentos.map((l) => ({
    contaBancariaId: l.contaBancariaId, data: dataEfetiva(l), valor: l.tipo === "DESPESA" ? -l.valor : l.valor,
  }))) : { semData: Math.round(saldoInicialTotal * 100), porData: {} as Record<string, number> };
  const saldoAntes =
    Object.entries(bases.porData).reduce((soma, [data, valor]) => data < periodo.de ? soma + valor : soma, bases.semData) / 100 +
    antesDoPeriodo.reduce((soma, l) => soma + (l.tipo === "DESPESA" ? -l.valor : l.valor), 0);

  function construirGrupos(tipo: TipoLancamento): LinhaGrupoPlanilha[] {
    const porGrupo = new Map<GrupoDre | "NAO_CLASSIFICADO", Map<string, LinhaCategoriaPlanilha>>();
    // Catálogo de consulta, independente das categorias permitidas para novos lançamentos.
    for (const categoria of planoContas) {
      if ((GRUPOS_RECEITA.includes(categoria.grupo) ? "RECEITA" : "DESPESA") !== tipo) continue;
      const categoriasDoGrupo = porGrupo.get(categoria.grupo) ?? new Map<string, LinhaCategoriaPlanilha>();
      categoriasDoGrupo.set(categoria.id, { categoriaId: categoria.id, categoriaNome: categoria.nome, paiId: categoria.paiId, tipo, porDia: {}, total: 0 });
      porGrupo.set(categoria.grupo, categoriasDoGrupo);
    }
    for (const l of noPeriodo.filter((l) => l.tipo === tipo)) {
      const grupo = l.semClassificacao ? "NAO_CLASSIFICADO" : l.categoriaGrupo;
      let categoriasDoGrupo = porGrupo.get(grupo);
      if (!categoriasDoGrupo) {
        categoriasDoGrupo = new Map();
        porGrupo.set(grupo, categoriasDoGrupo);
      }
      let linha = categoriasDoGrupo.get(l.categoriaId);
      if (!linha) {
        linha = { categoriaId: l.categoriaId, categoriaNome: l.categoriaNome, tipo, porDia: {}, total: 0 };
        categoriasDoGrupo.set(l.categoriaId, linha);
      }
      const dia = diaChave(dataEfetiva(l));
      const celula = linha.porDia[dia] ?? celulaVazia();
      somarNaCelula(celula, l);
      linha.porDia[dia] = celula;
      linha.total += l.valor;
    }

    const grupos: LinhaGrupoPlanilha[] = [];
    for (const grupo of [...ORDEM_GRUPOS_DRE, "NAO_CLASSIFICADO" as const]) {
      const categoriasDoGrupo = porGrupo.get(grupo);
      if (!categoriasDoGrupo) continue;
      const categorias = Array.from(categoriasDoGrupo.values()).sort((a, b) => b.total - a.total);
      const porDia: Record<string, CelulaPlanilha> = {};
      let total = 0;
      for (const categoria of categorias) {
        for (const [dia, celula] of Object.entries(categoria.porDia)) {
          const celulaGrupo = porDia[dia] ?? celulaVazia();
          celulaGrupo.valor += celula.valor;
          celulaGrupo.lancamentoIds.push(...celula.lancamentoIds);
          celulaGrupo.temPendente = celulaGrupo.temPendente || celula.temPendente;
          porDia[dia] = celulaGrupo;
        }
        total += categoria.total;
      }
      grupos.push({ grupo, grupoLabel: grupo === "NAO_CLASSIFICADO" ? "Faturas a classificar (fora do DRE)" : grupoDreLabels[grupo], tipo, categorias, porDia, total });
    }
    return grupos;
  }

  const receitas = construirGrupos("RECEITA");
  const despesas = construirGrupos("DESPESA");

  const totalReceitasPorDia: Record<string, number> = {};
  const totalDespesasPorDia: Record<string, number> = {};
  const saldoPorDia: Record<string, number> = {};

  let saldoAcumulado = saldoAntes;
  for (const dia of dias) {
    const totalReceita = receitas.reduce((soma, grupo) => soma + (grupo.porDia[dia]?.valor ?? 0), 0);
    const totalDespesa = despesas.reduce((soma, grupo) => soma + (grupo.porDia[dia]?.valor ?? 0), 0);
    totalReceitasPorDia[dia] = totalReceita;
    totalDespesasPorDia[dia] = totalDespesa;
    saldoAcumulado += (bases.porData[dia] ?? 0) / 100 + totalReceita - totalDespesa;
    saldoPorDia[dia] = saldoAcumulado;
  }

  const totalReceitasGeral = receitas.reduce((soma, l) => soma + l.total, 0);
  const totalDespesasGeral = despesas.reduce((soma, l) => soma + l.total, 0);

  return {
    dias,
    receitas,
    despesas,
    totalReceitasPorDia,
    totalDespesasPorDia,
    saldoPorDia,
    totalReceitasGeral,
    totalDespesasGeral,
    saldoFinal: saldoAcumulado,
  };
}

export type NoCategoriaFluxo = LinhaCategoriaPlanilha & { filhos: NoCategoriaFluxo[] };

/** Agregação somente de apresentação: não altera as linhas usadas nos totais do caixa. */
export function montarArvoreFluxoCaixa(linhas: LinhaCategoriaPlanilha[]): NoCategoriaFluxo[] {
  const nos = new Map(linhas.map(linha => [linha.categoriaId, {
    ...linha, filhos: [] as NoCategoriaFluxo[],
    porDia: Object.fromEntries(Object.entries(linha.porDia).map(([dia, celula]) => [dia, { ...celula, lancamentoIds: [...celula.lancamentoIds] }])),
  }]));
  const raizes: NoCategoriaFluxo[] = [];
  for (const no of nos.values()) {
    const visitados = new Set([no.categoriaId]);
    let ancestral = no.paiId ? nos.get(no.paiId) : undefined;
    let ciclo = false;
    while (ancestral) {
      if (visitados.has(ancestral.categoriaId)) { ciclo = true; break; }
      visitados.add(ancestral.categoriaId);
      ancestral = ancestral.paiId ? nos.get(ancestral.paiId) : undefined;
    }
    const pai = !ciclo && no.paiId ? nos.get(no.paiId) : undefined;
    if (pai) pai.filhos.push(no);
    else raizes.push(no);
  }
  function agregar(no: NoCategoriaFluxo) {
    for (const filho of no.filhos) {
      agregar(filho);
      no.total += filho.total;
      for (const [dia, celula] of Object.entries(filho.porDia)) {
        const atual = no.porDia[dia] ?? celulaVazia();
        atual.valor += celula.valor;
        atual.lancamentoIds.push(...celula.lancamentoIds);
        atual.temPendente ||= celula.temPendente;
        no.porDia[dia] = atual;
      }
    }
  }
  raizes.forEach(agregar);
  return raizes;
}
