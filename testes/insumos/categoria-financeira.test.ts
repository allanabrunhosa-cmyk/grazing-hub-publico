import { expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { resolverCategoriaCompraInsumo } from "@/lib/insumos/categoria-financeira";
function banco(categoriaFinanceiraId: string | null, categoria: unknown) {
  const tx = { insumo: { findUnique: vi.fn(async () => ({ nome: "Salame", categoriaFinanceiraId })) }, categoriaFinanceira: { findUnique: vi.fn(async () => categoria), findFirst: vi.fn(async () => ({ id: "cmv" })) } };
  return { tx: tx as unknown as Prisma.TransactionClient, simulado: tx };
}
it("usa classificação detalhada de despesa em qualquer grupo, inclusive pessoal", async () => {
  const { tx, simulado } = banco("alimentacao", { id: "alimentacao", ativo: true, excluidoEm: null, grupo: "DESPESAS_OPERACIONAIS" });
  expect(await resolverCategoriaCompraInsumo(tx, "salame")).toEqual({ id: "alimentacao" });
  expect(simulado.categoriaFinanceira.findFirst).not.toHaveBeenCalled();
});
it("mantém o padrão CMV apenas para item sem classificação", async () => {
  const { tx } = banco(null, null);
  expect(await resolverCategoriaCompraInsumo(tx, "salame")).toEqual({ id: "cmv" });
});
it.each([{ ativo: false, grupo: "CMV" }, { ativo: true, grupo: "CMV", excluidoEm: new Date() }, { ativo: true, grupo: "RECEITA_BRUTA" }])("bloqueia classificação inválida sem voltar silenciosamente ao padrão", async categoria => {
  const { tx, simulado } = banco("charcutaria", { id: "charcutaria", ...categoria });
  expect(await resolverCategoriaCompraInsumo(tx, "salame")).toHaveProperty("erro");
  expect(simulado.categoriaFinanceira.findFirst).not.toHaveBeenCalled();
});
