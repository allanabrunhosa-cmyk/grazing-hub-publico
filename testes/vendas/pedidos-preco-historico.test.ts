import { expect, it } from "vitest";
import { itemComercialPreservado } from "@/lib/vendas/pedidos-preco-historico";
import type { ItemPedidoEntrada } from "@/lib/vendas/pedidos-dominio";

const anterior = { id: "item", produtoId: "p", quantidade: "2", precoOriginal: "130.00", precoAplicado: "120.00", acrescimos: "10.00", escolhasSnapshot: [{ opcaoId: "o", quantidade: 1 }] };
const item: ItemPedidoEntrada = { itemOrigemId: "item", produtoId: "p", quantidade: "2", precoManual: "120", escolhas: { o: 1 }, observacoes: "Nova instrução" };
it("reconhece negociação histórica apesar de zeros e formatação monetária", () => {
  expect(itemComercialPreservado({ ...item, escolhas: { o: 1, inativa: 0 } }, anterior)).toBe(true);
  expect(itemComercialPreservado({ ...item, precoManual: null }, { ...anterior, precoAplicado: "130" })).toBe(true);
});
it("não reutiliza preço histórico quando produto, quantidade, escolhas ou preço negociado mudam", () => {
  for (const alteracao of [{ produtoId: "outro" }, { quantidade: "3" }, { escolhas: { o: 2 } }, { precoManual: "110" }, { precoManual: null }]) expect(itemComercialPreservado({ ...item, ...alteracao }, anterior)).toBe(false);
  expect(itemComercialPreservado(item)).toBe(false);
});
