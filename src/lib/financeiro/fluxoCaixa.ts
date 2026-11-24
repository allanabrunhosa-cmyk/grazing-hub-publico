import { dataParaIso } from "@/lib/financeiro/recorrencia";
import { GRUPOS_RECEITA, ORDEM_GRUPOS_DRE, grupoDreLabels } from "@/lib/labels";
import type { GrupoDre, StatusLancamento, TipoLancamento } from "@/generated/prisma/client";
import { calcularBasesSaldo, type SaldoInicialConta } from "@/lib/financeiro/saldos-iniciais";
import { periodoMesAteHoje } from "@/lib/financeiro/periodos";

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

/**
 * `valor` soma somente o que conta no caixa: realizado e provisão (pendente a vencer).
 * `naoRealizado` guarda os pendentes vencidos, exibidos mas fora de totais e saldo.
 */
export type CelulaPlanilha = { valor: number; lancamentoIds: string[]; temProvisao: boolean; naoRealizado: number };

export type SituacaoFluxoCaixa = "REALIZADO" | "PROVISAO" | "NAO_REALIZADO";

/**
 * Baixado é realizado. Pendente com vencimento hoje ou futuro é provisão; depois que a
 * data passa sem baixa, é pagamento não realizado e deixa de compor o saldo.
 */
export function situacaoNoFluxoCaixa(l: { status: StatusLancamento; dataVencimento: string }, hoje: string): SituacaoFluxoCaixa {
  if (l.status === "BAIXADO") return "REALIZADO";
  return l.dataVencimento.slice(0, 10) >= hoje ? "PROVISAO" : "NAO_REALIZADO";
}

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
  saldoComProvisao: Record<string, boolean>; // o saldo do dia inclui alguma provisão
  totalReceitasGeral: number;
  totalDespesasGeral: number;
  saldoFinal: number;
  saldoFinalComProvisao: boolean;
};

/** Resultado do período, sem incluir saldos iniciais ou somar saldos acumulados. */
export function calcularResultadoFluxoCaixa(receitas: number, despesas: number): number {
  return (Math.round(receitas * 100) - Math.round(despesas * 100)) / 100;
}

// A data que "conta" pro fluxo de caixa: lançamento baixado usa a data em que o
// dinheiro de fato entrou/saiu (dataPagamento); pendente usa o vencimento (provisão
// enquanto a data não passou; depois disso, pagamento não realizado).
function dataEfetiva(l: LancamentoParaPlanilha): string {
  return (l.status === "BAIXADO" ? l.dataPagamento : null) ?? l.dataVencimento;
}

function celulaVazia(): CelulaPlanilha {
  return { valor: 0, lancamentoIds: [], temProvisao: false, naoRealizado: 0 };
}

function agregarCelula(destino: CelulaPlanilha, origem: CelulaPlanilha) {
  destino.valor += origem.valor;
  destino.naoRealizado += origem.naoRealizado;
  destino.lancamentoIds.push(...origem.lancamentoIds);
  destino.temProvisao ||= origem.temProvisao;
}

// Lógica pura de agregação — monta a planilha em duas camadas (grupo do plano de
// contas > categoria) a partir dos lançamentos do período, com total por linha, por
// coluna e saldo acumulado ao final de cada dia. O saldo conta o realizado e, do dia
// de referência em diante, as provisões (pendentes a vencer), sinalizadas em
// `temProvisao`/`saldoComProvisao`. Pendente vencido aparece em `naoRealizado` e não
// entra em totais nem no saldo.
export function calcularPlanilhaFluxoCaixa(
  saldoInicialTotal: number,
  lancamentos: LancamentoParaPlanilha[],
  periodo: { de: string; ate: string },
  saldosIniciais?: SaldoInicialConta[],
  planoContas: { id: string; nome: string; grupo: GrupoDre; paiId?: string | null }[] = [],
  hoje: string = periodoMesAteHoje().ate
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

  const contados = lancamentos.filter((l) => situacaoNoFluxoCaixa(l, hoje) !== "NAO_REALIZADO");
  const antesDoPeriodo = contados.filter((l) => diaChave(dataEfetiva(l)) < periodo.de);
  const bases = saldosIniciais ? calcularBasesSaldo(saldosIniciais, contados.map((l) => ({
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
      const situacao = situacaoNoFluxoCaixa(l, hoje);
      celula.lancamentoIds.push(l.id);
      if (situacao === "NAO_REALIZADO") celula.naoRealizado += l.valor;
      else {
        celula.valor += l.valor;
        linha.total += l.valor;
        if (situacao === "PROVISAO") celula.temProvisao = true;
      }
      linha.porDia[dia] = celula;
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
          agregarCelula(celulaGrupo, celula);
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

  const saldoComProvisao: Record<string, boolean> = {};
  let saldoAcumulado = saldoAntes;
  let provisaoAcumulada = antesDoPeriodo.some((l) => l.status === "PENDENTE");
  for (const dia of dias) {
    provisaoAcumulada ||= [...receitas, ...despesas].some((grupo) => grupo.porDia[dia]?.temProvisao);
    saldoComProvisao[dia] = provisaoAcumulada;
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
    saldoComProvisao,
    totalReceitasGeral,
    totalDespesasGeral,
    saldoFinal: saldoAcumulado,
    saldoFinalComProvisao: provisaoAcumulada,
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
        agregarCelula(atual, celula);
        no.porDia[dia] = atual;
      }
    }
  }
  raizes.forEach(agregar);
  return raizes;
}
