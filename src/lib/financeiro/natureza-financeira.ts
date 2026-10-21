import type { GrupoDre, TipoLancamento } from "@/generated/prisma/client";
import { GRUPOS_RECEITA } from "@/lib/labels";

export type NaturezaFinanceira = "ENTRADA" | "SAIDA";

export const estilosNaturezaFinanceira = {
  ENTRADA: {
    rotulo: "Entrada",
    texto: "text-success",
    borda: "border-l-4 border-l-success",
    fundo: "bg-success-bg/55",
    indicador: "bg-success-bg text-success",
    ponto: "bg-success",
    varianteBotao: "entrada",
    varianteBotaoContorno: "entrada-outline",
  },
  SAIDA: {
    rotulo: "Saída",
    texto: "text-destructive",
    borda: "border-l-4 border-l-destructive",
    fundo: "bg-destructive/5",
    indicador: "bg-destructive/10 text-destructive",
    ponto: "bg-destructive",
    varianteBotao: "saida",
    varianteBotaoContorno: "saida-outline",
  },
} as const;

export function naturezaFinanceiraDoGrupo(grupo: GrupoDre): NaturezaFinanceira {
  return GRUPOS_RECEITA.includes(grupo) ? "ENTRADA" : "SAIDA";
}

export function naturezaFinanceiraDoTipo(tipo: TipoLancamento): NaturezaFinanceira {
  return tipo === "RECEITA" ? "ENTRADA" : "SAIDA";
}

export function naturezaFinanceiraDoValor(valor: number): NaturezaFinanceira {
  return valor < 0 ? "SAIDA" : "ENTRADA";
}
