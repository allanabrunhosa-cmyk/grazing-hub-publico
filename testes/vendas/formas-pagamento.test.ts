import { describe, expect, it } from "vitest";
import { taxasNaParcela, validarFormaPagamentoVenda, type FormaPagamentoVendaEntrada } from "@/lib/vendas/formas-pagamento";

const credito: FormaPagamentoVendaEntrada = {
  id: "", versao: 0, nome: "Cartão de crédito", tipo: "CARTAO_CREDITO",
  taxaPercentual: "2.49", taxaFixa: "0.49", prazoDias: 32,
  inicioPrazo: "PAGAMENTO", contagemPrazo: "CORRIDOS", vencimentoFlexivel: true,
  permiteParcelamento: true, maximoParcelas: 21, faixasTaxa: [], observacoes: null, ativo: true,
};

describe("condições de pagamento de Vendas", () => {
  it("aceita percentual e taxa fixa combinados, com prazo máximo flexível", () => {
    const forma = validarFormaPagamentoVenda(credito);
    expect(forma).toMatchObject({ taxaPercentual: "2.49", taxaFixa: "0.49", prazoDias: 32, vencimentoFlexivel: true, maximoParcelas: 21 });
    expect(taxasNaParcela(forma, 12)).toEqual({ percentual: 2.49, fixa: 0.49 });
  });

  it("soma as taxas extras somente dentro da faixa de parcelas", () => {
    const forma = validarFormaPagamentoVenda({ ...credito, faixasTaxa: [{ de: 13, ate: 21, percentual: "0.80", fixa: "0.20" }] });
    expect(taxasNaParcela(forma, 12)).toEqual({ percentual: 2.49, fixa: 0.49 });
    expect(taxasNaParcela(forma, 13)).toEqual({ percentual: 3.29, fixa: 0.69 });
  });

  it("recusa faixas sobrepostas, fora do limite e taxas acima de 100%", () => {
    expect(() => validarFormaPagamentoVenda({ ...credito, faixasTaxa: [
      { de: 2, ate: 6, percentual: "0", fixa: "0" }, { de: 6, ate: 10, percentual: "0", fixa: "0" },
    ] })).toThrow("sobrepor");
    expect(() => validarFormaPagamentoVenda({ ...credito, faixasTaxa: [{ de: 13, ate: 22, percentual: "0", fixa: "0" }] })).toThrow("1 a 21");
    expect(() => validarFormaPagamentoVenda({ ...credito, faixasTaxa: [{ de: 13, ate: 21, percentual: "99", fixa: "0" }] })).toThrow("100%");
  });

  it("não aceita parcelamento incompleto nem vencimento flexível sem prazo", () => {
    expect(() => validarFormaPagamentoVenda({ ...credito, permiteParcelamento: false, maximoParcelas: 21 })).toThrow("parcelamento");
    expect(() => validarFormaPagamentoVenda({ ...credito, prazoDias: 0 })).toThrow("maior que zero");
    expect(() => validarFormaPagamentoVenda({ ...credito, taxaFixa: "1,999" })).toThrow("casas decimais");
  });
});
