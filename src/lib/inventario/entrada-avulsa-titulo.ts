import { paraCaixaAlta } from "@/lib/caixa-alta";

/** O título identifica a compra; modalidade, parcelas e valores ficam nos campos próprios. */
export function tituloEntradaAvulsa(fornecedor: string | null | undefined, produtos: readonly string[]): string {
  const nomes = [...new Set(produtos.map(nome => paraCaixaAlta(nome.trim().replace(/\s+/g, " "))).filter(Boolean))];
  return [paraCaixaAlta((fornecedor ?? "").replace(/\s+/g, " ")), nomes.join(", ")].filter(Boolean).join(" — ");
}
