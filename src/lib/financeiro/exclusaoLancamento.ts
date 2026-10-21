import type { Prisma } from "@/generated/prisma/client";

export type EscopoExclusaoLancamento = "APENAS_ESTA" | "GRUPO_PENDENTE" | "COMPRA_INTEGRAL";
export type ResumoExclusaoLancamento = {
  compra?: import("./cancelamento-compra-tipos").ResumoCancelamentoCompra;
  descricao: string;
  grupo: "RECORRENCIA" | "PARCELAS_NOTA" | null;
  pendentes: number;
  realizados: number;
};

// O vínculo salvo define o grupo; descrições e datas nunca são usadas para adivinhar parcelas.
export function filtroGrupoLancamento(lancamento: {
  recorrenciaGrupoId: string | null;
  notaFiscalItemLancamento: { notaFiscalItemId: string } | null;
}): { grupo: ResumoExclusaoLancamento["grupo"]; filtro: Prisma.LancamentoFinanceiroWhereInput | null } {
  if (lancamento.recorrenciaGrupoId) return {
    grupo: "RECORRENCIA", filtro: { recorrenciaGrupoId: lancamento.recorrenciaGrupoId },
  };
  if (lancamento.notaFiscalItemLancamento) return {
    grupo: "PARCELAS_NOTA", filtro: { notaFiscalItemLancamento: { notaFiscalItemId: lancamento.notaFiscalItemLancamento.notaFiscalItemId } },
  };
  return { grupo: null, filtro: null };
}
