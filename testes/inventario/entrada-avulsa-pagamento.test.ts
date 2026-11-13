import { describe, expect, it } from "vitest";
import { gerarParcelasEntrada, pagamentosEntradaIguais, validarPagamentoEntrada, type PagamentoEntradaInput } from "@/lib/inventario/entrada-avulsa-pagamento";

const plano: PagamentoEntradaInput = { formaPagamento: "PIX", parcelas: [{ valor: 100, dataVencimento: "2026-11-13" }] };

describe("parcelas da entrada avulsa", () => {
  it("divide em centavos, sem multiplicar a obrigação, e conserva o dia original nos meses seguintes", () => {
    const parcelas = gerarParcelasEntrada({ valorTotal: 100.01, quantidade: 3, dataVencimento: "2027-01-31", formaPagamento: "BOLETO" });
    expect(parcelas).toEqual([{ valor: 33.34, dataVencimento: "2027-01-31" }, { valor: 33.34, dataVencimento: "2027-02-28" }, { valor: 33.33, dataVencimento: "2027-03-31" }]);
    expect(validarPagamentoEntrada({ ...plano, parcelas }, 100.01).parcelas).toEqual(parcelas);
  });

  it("usa o calendário da fatura e o ordinal inicial em todas as parcelas do cartão", () => {
    expect(gerarParcelasEntrada({ valorTotal: 30, quantidade: 3, dataVencimento: "2026-11-20", formaPagamento: "CARTAO", cartao: { diaFechamento: 10, diaVencimento: 20 }, dataCompra: "2026-11-10", parcelaCartao: 2 }))
      .toEqual([{ valor: 10, dataVencimento: "2027-01-20" }, { valor: 10, dataVencimento: "2027-02-20" }, { valor: 10, dataVencimento: "2027-03-20" }]);
  });

  it("aceita rascunho zero, mas exige parcelas positivas ao salvar", () => {
    const parcelas = gerarParcelasEntrada({ valorTotal: 0, quantidade: 2, dataVencimento: "2026-11-13", formaPagamento: "PIX" });
    expect(parcelas.map(p => p.valor)).toEqual([0, 0]);
    expect(() => validarPagamentoEntrada({ ...plano, parcelas }, 0)).toThrow("positivas");
  });

  it("aceita até 36 parcelas e bloqueia soma divergente, data impossível e fração de centavo", () => {
    const parcelas = gerarParcelasEntrada({ valorTotal: 36.01, quantidade: 36, dataVencimento: "2026-11-13", formaPagamento: "PIX" });
    expect(parcelas).toHaveLength(36);
    expect(parcelas[0].valor).toBe(1.01);
    expect(validarPagamentoEntrada({ ...plano, parcelas }, 36.01).parcelas).toHaveLength(36);
    expect(() => gerarParcelasEntrada({ valorTotal: 36, quantidade: 37, dataVencimento: "2026-11-13", formaPagamento: "PIX" })).toThrow("36");
    expect(() => validarPagamentoEntrada(plano, 100.01)).toThrow("soma");
    expect(() => validarPagamentoEntrada({ ...plano, parcelas: [{ valor: 100, dataVencimento: "2027-02-29" }] }, 100)).toThrow("vencimento");
    expect(() => validarPagamentoEntrada({ ...plano, parcelas: [{ valor: 100.001, dataVencimento: "2026-11-13" }] }, 100.001)).toThrow("duas casas");
  });

  it("limita o ordinal final do cartão e todas as datas operacionais", () => {
    expect(() => validarPagamentoEntrada({ formaPagamento: "CARTAO", cartaoCreditoId: "cartao", dataCompra: "2026-11-01", parcelaCartao: 120,
      parcelas: [{ valor: 50, dataVencimento: "2026-11-20" }, { valor: 50, dataVencimento: "2026-12-20" }] }, 100)).toThrow("parcela inicial");
    expect(() => gerarParcelasEntrada({ valorTotal: 100, quantidade: 2, dataVencimento: "2200-12-31", formaPagamento: "PIX" })).toThrow("intervalo");
  });

  it("compara planos sem depender da ordem de propriedades, parcelas ou metadata de outra forma", () => {
    const a: PagamentoEntradaInput = { formaPagamento: "PIX", parcelas: [{ valor: 30, dataVencimento: "2026-12-13" }, { valor: 70, dataVencimento: "2026-11-13" }] };
    expect(pagamentosEntradaIguais(a, { parcelas: [...a.parcelas].reverse(), formaPagamento: "PIX", cartaoCreditoId: "antigo", dataCompra: "2026-10-01", parcelaCartao: 3 })).toBe(true);
    expect(pagamentosEntradaIguais(a, { ...a, formaPagamento: "BOLETO" })).toBe(false);
  });
});
