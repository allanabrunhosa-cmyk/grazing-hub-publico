import { tipoEstoqueLabels, unidadeMedidaLabels } from "@/lib/labels";
import type { ContagemItemRow } from "@/app/(protegido)/inventario/types";

export const colunasContagem = {
  nome: "Insumo",
  marcas: "Marcas",
  fornecedores: "Fornecedores",
  tipoEstoque: "Tipo de estoque",
  unidade: "Unidade",
  quantidadeSistema: "Sistema",
  quantidadeContada: "Quantidade contada",
  diferenca: "Diferença",
  ajustado: "Ajustado",
};

export type OrdenacaoContagem = { coluna: keyof typeof colunasContagem; direcao: "asc" | "desc" };

export function ordenarItensContagem(itens: ContagemItemRow[], ordenacao: OrdenacaoContagem) {
  function valor(item: ContagemItemRow): string | number | null {
    switch (ordenacao.coluna) {
      case "marcas": return item.marcas?.join(", ") || null;
      case "fornecedores": return item.fornecedores.join(", ") || null;
      case "tipoEstoque": return item.tipoEstoque ? tipoEstoqueLabels[item.tipoEstoque] : null;
      case "unidade": return unidadeMedidaLabels[item.unidade];
      case "ajustado": return item.ajustado ? "Sim" : "Não";
      case "diferenca": return item.contado && item.quantidadeSistema != null && item.quantidadeContada != null
        ? item.quantidadeContada - item.quantidadeSistema : null;
      default: return item[ordenacao.coluna];
    }
  }
  return [...itens].sort((a, b) => {
    const primeiro = valor(a);
    const segundo = valor(b);
    // Valores ausentes ficam no fim em ambas as direções.
    if (primeiro == null && segundo != null) return 1;
    if (primeiro != null && segundo == null) return -1;
    const comparacao = primeiro == null || segundo == null ? 0
      : typeof primeiro === "number" && typeof segundo === "number" ? primeiro - segundo
      : String(primeiro).localeCompare(String(segundo), "pt-BR", { sensitivity: "base" });
    return comparacao * (ordenacao.direcao === "asc" ? 1 : -1) || a.nome.localeCompare(b.nome, "pt-BR");
  });
}
