import { describe, expect, it } from "vitest";
import { dataCompraCivil, dataCompraValida, vencimentoPrazoPedido } from "@/lib/vendas/pedidos-data-compra";
import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";
import { validarIdentidadeCobranca } from "@/lib/vendas/dominio";

describe("Data civil da compra", () => {
  it.each(["2000-01-01", "2024-02-29", "2200-12-31"])("aceita calendário válido: %s", dataCompra => {
    expect(dataCompraValida(dataCompra)).toBe(true);
    expect(validarEntradaPedido({ itens: [], dataCompra }).dataCompra).toBe(dataCompra);
  });
  it.each(["1999-12-31", "2201-01-01", "2026-02-29", "2026-04-31", "2026-1-02", "2026-10-20T12:00:00Z", "", null, 20261020])("recusa data inválida sem normalizar: %s", dataCompra => {
    expect(dataCompraValida(dataCompra)).toBe(false);
    expect(() => validarEntradaPedido({ itens: [], dataCompra })).toThrow("Data da compra");
  });
  it("preserva ausência legada e serializa DATE sem mudar de dia", () => {
    expect(validarEntradaPedido({ itens: [] })).not.toHaveProperty("dataCompra");
    expect(dataCompraCivil(null)).toBeNull();
    expect(dataCompraCivil(new Date("2026-03-01T00:00:00Z"))).toBe("2026-03-01");
  });
  it("usa exclusivamente o prazo configurado e distingue venda de pagamento", () => {
    const forma = { prazoDias: 10, inicioPrazo: "VENDA", contagemPrazo: "CORRIDOS", vencimentoFlexivel: false };
    expect(vencimentoPrazoPedido(forma, "2026-02-25")).toBe("2026-03-07");
    expect(vencimentoPrazoPedido({ ...forma, inicioPrazo: "PAGAMENTO" }, "2026-02-25")).toBeNull();
    expect(vencimentoPrazoPedido({ ...forma, inicioPrazo: "PAGAMENTO" }, "2026-02-25", "2026-03-02")).toBe("2026-03-12");
    expect(vencimentoPrazoPedido({ ...forma, prazoDias: 0 }, "2026-02-25")).toBe("2026-02-25");
  });
});

describe("Telefone opcional próprio da cobrança", () => {
  it("preserva telefone independente sem transformar ausência em dado novo", () => {
    const pf = { tipo: "PF", nomeCompleto: "Pessoa sintética" };
    expect(validarIdentidadeCobranca(pf)).not.toHaveProperty("telefone");
    expect(validarIdentidadeCobranca({ ...pf, telefone: "" })).toMatchObject({ telefone: "" });
    expect(validarIdentidadeCobranca({ ...pf, telefone: "+55 (11) 91234-5678" })).toMatchObject({ telefone: "+5511912345678" });
  });
  it.each(["123", "+1 2121234567", "11912345678 ramal2", "119123456789"])("recusa telefone inválido: %s", telefone => {
    expect(() => validarIdentidadeCobranca({ tipo: "PJ", telefone })).toThrow("telefone da cobrança");
  });
});
