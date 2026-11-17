import { expect, it } from "vitest";
import { taxaRecebimentoPix } from "@/lib/vendas/pedidos-taxa-recebimento";

const pix = (taxaPercentual: string, taxaFixa: string) => ({ tipo: "PIX", taxaPercentual, taxaFixa });

it("Pix sem taxa não gera despesa", () => {
  expect(taxaRecebimentoPix(pix("0", "0"), "350.00")).toBe("0.00");
  expect(taxaRecebimentoPix({ tipo: "PIX" }, "350.00")).toBe("0.00");
});

it("taxa fixa soma uma vez por recebimento, inclusive parcial", () => {
  expect(taxaRecebimentoPix(pix("0", "0.75"), "350.00")).toBe("0.75");
  expect(taxaRecebimentoPix(pix("0.00", "0.75"), "40")).toBe("0.75");
});

it("percentual incide sobre o valor recebido com arredondamento ao centavo", () => {
  expect(taxaRecebimentoPix(pix("1.5", "0"), "100.00")).toBe("1.50");
  expect(taxaRecebimentoPix(pix("0.99", "0"), "33.33")).toBe("0.33");
  expect(taxaRecebimentoPix(pix("0.5", "0"), "1.00")).toBe("0.01");
  expect(taxaRecebimentoPix(pix("0.49", "0"), "1.00")).toBe("0.00");
  expect(taxaRecebimentoPix(pix("1", "0.75"), "999999999999.99")).toBe("10000000000.75");
});

it("outras formas e dados inválidos resultam em zero", () => {
  expect(taxaRecebimentoPix({ tipo: "BOLETO", taxaPercentual: "2", taxaFixa: "1" }, "100.00")).toBe("0.00");
  expect(taxaRecebimentoPix({ tipo: "CREDITO_CLIENTE", valor: "10.00" }, "10.00")).toBe("0.00");
  expect(taxaRecebimentoPix(null, "100.00")).toBe("0.00");
  expect(taxaRecebimentoPix(pix("abc", "0.75"), "100.00")).toBe("0.00");
  expect(taxaRecebimentoPix(pix("1", "0.75"), "")).toBe("0.00");
  expect(taxaRecebimentoPix(pix("1", "0.75"), "0.00")).toBe("0.00");
});
