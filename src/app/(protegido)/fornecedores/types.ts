import type { Fornecedor } from "@/generated/prisma/client";

export type SimpleOption = { id: string; nome: string };

export type FornecedorRow = Fornecedor & {
  quantidadeInsumos?: number;
  canaisPedido: SimpleOption[];
  formasPagamento: SimpleOption[];
  insumosVinculados: { id: string; nome: string; especificacao?: string | null }[];
};
