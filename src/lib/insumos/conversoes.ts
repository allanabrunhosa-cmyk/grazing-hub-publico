import { UnidadeMedida } from "@/generated/prisma/browser";
import { unidadeMedidaAbreviada } from "@/lib/labels";

export type ConversaoInsumo = { unidade: UnidadeMedida; fator: number };

export function validarConversoes(valor: unknown, unidadePrincipal: UnidadeMedida): { erro: string } | { conversoes: ConversaoInsumo[] } {
  if (!Array.isArray(valor) || valor.length > Object.values(UnidadeMedida).length - 1) {
    return { erro: "Lista de conversões inválida." };
  }
  const unidades = new Set<UnidadeMedida>();
  const conversoes: ConversaoInsumo[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object" || !Object.values(UnidadeMedida).includes(item.unidade) || item.unidade === unidadePrincipal) {
      return { erro: "Escolha uma unidade de conversão diferente da unidade principal." };
    }
    if (unidades.has(item.unidade)) return { erro: "Cadastre apenas um fator para cada unidade de conversão." };
    const texto = typeof item.fator === "number" || typeof item.fator === "string" ? String(item.fator).trim().replace(",", ".") : "";
    const fator = Number(texto);
    if (!/^\d+(?:\.\d{1,6})?$/.test(texto) || !Number.isFinite(fator) || fator <= 0 || fator >= 1_000_000_000) {
      return { erro: "Informe fatores maiores que zero, com até seis casas decimais e menores que 1 bilhão." };
    }
    unidades.add(item.unidade);
    conversoes.push({ unidade: item.unidade, fator });
  }
  return { conversoes };
}

export function formatarQuantidadeConversao(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

export function descreverConversao(conversao: ConversaoInsumo, unidadePrincipal: UnidadeMedida): string {
  return `1 ${unidadeMedidaAbreviada[conversao.unidade]} = ${formatarQuantidadeConversao(conversao.fator)} ${unidadeMedidaAbreviada[unidadePrincipal]}`;
}

export function fatorDaUnidade(unidade: UnidadeMedida, unidadePrincipal: UnidadeMedida, conversoes: ConversaoInsumo[] = []): number | null {
  return unidade === unidadePrincipal ? 1 : conversoes.find((conversao) => conversao.unidade === unidade)?.fator ?? null;
}

export function descreverEquivalencia(quantidade: number, fator: number, unidadePrincipal: UnidadeMedida): string {
  return `${formatarQuantidadeConversao(quantidade * fator)} ${unidadeMedidaAbreviada[unidadePrincipal]}`;
}
