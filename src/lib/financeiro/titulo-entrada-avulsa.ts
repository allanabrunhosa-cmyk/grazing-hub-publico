import type { Prisma } from "@/generated/prisma/client";
import { tituloEntradaAvulsa } from "@/lib/inventario/entrada-avulsa-titulo";

const compra = {
  fornecedor: { select: { nome: true } },
  registro: { select: { snapshot: true } },
  movimentacoes: { where: { tipo: "ENTRADA_COMPRA" as const }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }], select: { insumo: { select: { nome: true } } } },
} satisfies Prisma.EntradaAvulsaCompraSelect;

/** Apenas leitura. Não regrava títulos, versões, pagamentos ou movimentos antigos. */
export const incluirTituloEntradaAvulsa = {
  origemEntradaAvulsaCompra: { select: compra },
  origemMovimentacaoEstoque: { select: { tipo: true, insumo: { select: { nome: true } }, entradaAvulsaCompra: { select: compra } } },
} satisfies Prisma.LancamentoFinanceiroInclude;

type Origem = Prisma.LancamentoFinanceiroGetPayload<{ include: typeof incluirTituloEntradaAvulsa }>;
type Titulo = Pick<Origem, "descricao"> & Partial<Pick<Origem, "origemEntradaAvulsaCompra" | "origemMovimentacaoEstoque">>;

function nomesSnapshot(snapshot: Prisma.JsonValue | undefined): string[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || !Array.isArray(snapshot.itens)) return [];
  return snapshot.itens.flatMap(item => item && typeof item === "object" && !Array.isArray(item) && typeof item.nome === "string" && item.nome.trim() ? [item.nome] : []);
}

export function descricaoTituloEntradaAvulsa(titulo: Titulo): string {
  const origem = titulo.origemEntradaAvulsaCompra ?? titulo.origemMovimentacaoEstoque?.entradaAvulsaCompra;
  if (origem) {
    const nomesVigentes = nomesSnapshot(origem.registro?.snapshot);
    return tituloEntradaAvulsa(origem.fornecedor.nome, nomesVigentes.length ? nomesVigentes : origem.movimentacoes.map(m => m.insumo.nome));
  }
  // Entradas anteriores ao cabeçalho de compra conservam somente a origem física.
  if (titulo.origemMovimentacaoEstoque?.tipo === "ENTRADA_COMPRA") {
    const fornecedor = titulo.descricao.replace(/^COMPRA SEM NOTA\s*[—–-]?\s*/i, "");
    return tituloEntradaAvulsa(fornecedor, [titulo.origemMovimentacaoEstoque.insumo.nome]);
  }
  return titulo.descricao;
}
