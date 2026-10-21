import { Prisma } from "@/generated/prisma/browser";

// A API recebe números finitos. A precisão cobre sua faixa decimal, inclusive
// frações pequenas somadas a saldos inteiros, sem limitar o estoque a milésimos.
export const DecimalEstoque = Prisma.Decimal.clone({ precision: 400 });
export const formatarQuantidadeEstoque = (valor: number) =>
  valor.toLocaleString("pt-BR", { maximumSignificantDigits: 21 });
