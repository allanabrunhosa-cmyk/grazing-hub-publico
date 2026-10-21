import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Apenas identidade numérica; o estoque continua no livro de movimentos existente. */
export async function numeroEntradaLegada(tx: Prisma.TransactionClient, origem: string) {
  const rows = await tx.$queryRaw<{ numero: number }[]>`SELECT numero FROM "NumeroEntradaAvulsaLegada" WHERE origem = ${origem}`;
  if (!rows[0]) throw new Error("A numeração desta entrada não está disponível. Confira a atualização do sistema.");
  return rows[0].numero;
}
