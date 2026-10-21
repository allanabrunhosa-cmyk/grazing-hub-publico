import type { GrupoDre } from "@/generated/prisma/client";
import { ORDEM_GRUPOS_DRE, grupoDreLabels } from "@/lib/labels";

export type ModoDre = "COMPETENCIA" | "CAIXA";

export type LancamentoParaDre = {
  liquidacoesCartao?: { valor: number; data: string }[];
  valor: number;
  valorCompetencia?: number;
  status: "PENDENTE" | "BAIXADO" | "CANCELADO";
  dataCompetencia: string; // ISO
  dataPagamento: string | null; // ISO
  categoriaId: string;
  categoriaNome: string;
  categoriaGrupo: GrupoDre;
  pedidoQuitadoCredito?: boolean;
};

export type LinhaDreCategoria = { categoriaId: string; nome: string; valor: number };
export type LinhaDreGrupo = { grupo: GrupoDre; label: string; total: number; categorias: LinhaDreCategoria[] };

export type ResultadoDre = {
  grupos: Record<GrupoDre, LinhaDreGrupo>;
  faturamentoBruto: number;
  deducoes: number;
  faturamentoLiquido: number;
  cmv: number;
  despesasVariaveis: number;
  totalCustosVariaveis: number;
  margemContribuicao: number;
  folhaPagamento: number;
  despesasOperacionais: number;
  totalDespesasFixas: number;
  loai: number;
  investimentos: number;
  ebitda: number;
  despesasFinanceiras: number;
  depreciacaoAmortizacao: number;
  receitasNaoOperacionais: number;
  despesasNaoOperacionais: number;
  resultadoLiquido: number;
};

// Lógica pura de agregação do waterfall do DRE — sem I/O, roda tanto no servidor quanto
// no client (a tela carrega os lançamentos uma vez e recalcula ao trocar período/modo,
// mesmo padrão de filtro 100% client-side já usado no resto do sistema).
// Competência usa dataCompetencia (todo lançamento não cancelado); Caixa usa
// dataPagamento e só o que já foi de fato baixado.
export function calcularDre(
  lancamentos: LancamentoParaDre[],
  periodo: { de: Date; ate: Date },
  modo: ModoDre
): ResultadoDre {
  const deTs = periodo.de.getTime();
  const ateTs = periodo.ate.getTime();

  const base = modo === "CAIXA" ? lancamentos.flatMap(l => l.liquidacoesCartao === undefined ? [l]
    : l.liquidacoesCartao.map(q => ({ ...l, valor: q.valor, status: "BAIXADO" as const, dataPagamento: q.data }))) : lancamentos;
  const filtrados = base.filter((l) => {
    if (modo === "CAIXA") {
      if (l.pedidoQuitadoCredito) return false;
      if (l.status !== "BAIXADO" || !l.dataPagamento) return false;
      const ts = new Date(l.dataPagamento).getTime();
      return ts >= deTs && ts <= ateTs;
    }
    if (l.status === "CANCELADO") return false;
    const ts = new Date(l.dataCompetencia).getTime();
    return ts >= deTs && ts <= ateTs;
  });

  const grupos = Object.fromEntries(
    ORDEM_GRUPOS_DRE.map((grupo) => [grupo, { grupo, label: grupoDreLabels[grupo], total: 0, categorias: [] }])
  ) as unknown as Record<GrupoDre, LinhaDreGrupo>;

  for (const lancamento of filtrados) {
    const valor = modo === "COMPETENCIA" ? lancamento.valorCompetencia ?? lancamento.valor : lancamento.valor;
    const linha = grupos[lancamento.categoriaGrupo];
    linha.total += valor;
    const categoriaExistente = linha.categorias.find((c) => c.categoriaId === lancamento.categoriaId);
    if (categoriaExistente) {
      categoriaExistente.valor += valor;
    } else {
      linha.categorias.push({ categoriaId: lancamento.categoriaId, nome: lancamento.categoriaNome, valor });
    }
  }

  const faturamentoBruto = grupos.RECEITA_BRUTA.total;
  const deducoes = grupos.DEDUCOES_RECEITA.total;
  const faturamentoLiquido = faturamentoBruto - deducoes;

  const cmv = grupos.CMV.total;
  const despesasVariaveis = grupos.DESPESAS_VARIAVEIS.total;
  const totalCustosVariaveis = cmv + despesasVariaveis;
  const margemContribuicao = faturamentoLiquido - totalCustosVariaveis;

  const folhaPagamento = grupos.FOLHA_PAGAMENTO.total;
  const despesasOperacionais = grupos.DESPESAS_OPERACIONAIS.total;
  const totalDespesasFixas = folhaPagamento + despesasOperacionais;
  const loai = margemContribuicao - totalDespesasFixas;

  const investimentos = grupos.INVESTIMENTOS.total;
  const ebitda = loai - investimentos;

  const despesasFinanceiras = grupos.DESPESAS_FINANCEIRAS.total;
  const depreciacaoAmortizacao = grupos.DEPRECIACAO_AMORTIZACAO.total;
  const receitasNaoOperacionais = grupos.RECEITAS_NAO_OPERACIONAIS.total;
  const despesasNaoOperacionais = grupos.DESPESAS_NAO_OPERACIONAIS.total;

  const resultadoLiquido =
    ebitda - despesasFinanceiras - depreciacaoAmortizacao + receitasNaoOperacionais - despesasNaoOperacionais;

  return {
    grupos,
    faturamentoBruto,
    deducoes,
    faturamentoLiquido,
    cmv,
    despesasVariaveis,
    totalCustosVariaveis,
    margemContribuicao,
    folhaPagamento,
    despesasOperacionais,
    totalDespesasFixas,
    loai,
    investimentos,
    ebitda,
    despesasFinanceiras,
    depreciacaoAmortizacao,
    receitasNaoOperacionais,
    despesasNaoOperacionais,
    resultadoLiquido,
  };
}
