import type { Prisma } from "@/generated/prisma/client";

// O CNPJ do emitente identifica a memória, mesmo quando o cadastro muda depois.
export async function resolverFornecedorNota(banco: Pick<Prisma.TransactionClient, "fornecedor" | "fornecedorNotaVinculo">, cnpj: string | null) {
  if (!cnpj) return null;
  const vinculo = await banco.fornecedorNotaVinculo.findUnique({
    where: { cnpj }, include: { fornecedor: { select: { id: true, nome: true, ativo: true, tipoCadastro: true } } },
  });
  if (vinculo) return vinculo.fornecedor.ativo && vinculo.fornecedor.tipoCadastro === "FORNECEDOR" ? { id: vinculo.fornecedor.id, nome: vinculo.fornecedor.nome, memorizado: true } : null;
  const fornecedor = await banco.fornecedor.findUnique({ where: { cnpj }, select: { id: true, nome: true, ativo: true, tipoCadastro: true } });
  return fornecedor?.ativo && fornecedor.tipoCadastro === "FORNECEDOR" ? { id: fornecedor.id, nome: fornecedor.nome, memorizado: false } : null;
}
