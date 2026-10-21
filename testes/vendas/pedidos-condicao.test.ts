import { describe, expect, it } from "vitest";
import { condicaoDoPagamento } from "@/lib/vendas/pedidos-condicao";

const base = { total: "100.00", categoriaId: "receita-canal", dataCompetencia: "2026-10-02" };
const pagamento = { formaId: "boleto", nome: "Boleto", tipo: "BOLETO", versao: 1, parcelas: 3, vencimentos: ["2026-10-10", "2026-11-10", "2026-12-10"] };
describe("Condição financeira derivada do pagamento", () => {
  it("divide centavos exatamente e conserva vencimentos explícitos de boleto", () => {
    const c = condicaoDoPagamento({ ...base, pagamento });
    expect(c.parcelas.map(p => p.valor)).toEqual(["33.34", "33.33", "33.33"]);
    expect(c.parcelas.map(p => p.vencimento)).toEqual(pagamento.vencimentos);
  });
  it("subtrai o crédito sem alterar valor comercial e admite cobertura integral", () => {
    expect(condicaoDoPagamento({ ...base, credito: "10.00", pagamento }).parcelas.map(p => p.valor)).toEqual(["30.00", "30.00", "30.00"]);
    expect(condicaoDoPagamento({ ...base, credito: "100.00", pagamento: null }).parcelas).toEqual([]);
    expect(() => condicaoDoPagamento({ ...base, credito: "100.01", pagamento })).toThrow("excede");
  });
  it("fotografa quatro parcelas do cartão sem inventar quatro repasses", () => {
    expect(condicaoDoPagamento({ ...base, pagamento: { ...pagamento, tipo: "CARTAO_CREDITO", parcelas: 4, vencimentos: [] } }).parcelas).toEqual([{ valor: "100.00", formaPagamentoVendaId: "boleto", parcelasCliente: 4, vencimento: "2026-10-02" }]);
  });
  it("recusa dinheiro impreciso, parcela de valor zero e pagamento ausente", () => {
    for (const total of ["1.001", "NaN", "-1", "1e2"]) expect(() => condicaoDoPagamento({ ...base, total, pagamento })).toThrow();
    expect(() => condicaoDoPagamento({ ...base, total: "0.02", pagamento })).toThrow("insuficiente");
    expect(() => condicaoDoPagamento({ ...base, pagamento: null })).toThrow("forma de pagamento");
  });
});
