import { expect, it } from "vitest";
import { dividirParcelaCartao } from "@/lib/notas-fiscais/parcelamento-cartao";

const cartoes = [{ id: "c", nome: "Cartão exemplo", contaBancariaId: "b", contaBancariaNome: "Conta exemplo", diaFechamento: 8, diaVencimento: 15, ativo: true }];
const parcela = { id: "original", numero: "001", valor: "149.52", formaPagamento: "CARTAO" as const, cartaoCreditoId: "c", dataCompra: "2026-09-25", parcelaCartao: 4, dataVencimento: "2027-01-15" };

it("divide o total em quatro faturas, conservando a identidade da primeira e o valor total", () => {
  const resultado = dividirParcelaCartao([parcela], 0, 4, cartoes);
  expect(resultado.map(p => p.valor)).toEqual(["37.38", "37.38", "37.38", "37.38"]);
  expect(resultado.map(p => p.dataVencimento)).toEqual(["2026-10-15", "2026-11-15", "2026-12-15", "2027-01-15"]);
  expect(resultado.map(p => p.parcelaCartao)).toEqual([1, 2, 3, 4]);
  expect(resultado.map(p => p.id)).toEqual(["original", undefined, undefined, undefined]);
  expect(resultado.map(p => p.numero)).toEqual(["001", "002", "003", "004"]);
  expect(parcela.valor).toBe("149.52");
  expect(parcela.parcelaCartao).toBe(4);
});

it("distribui centavos sem perda e preserva as demais duplicatas e seus números", () => {
  const outra = { ...parcela, id: "outra", numero: "002", valor: "50.00" };
  const resultado = dividirParcelaCartao([{ ...parcela, valor: "100,00" }, outra], 0, 3, cartoes);
  expect(resultado.map(p => p.valor)).toEqual(["33.34", "33.33", "33.33", "50.00"]);
  expect(resultado.map(p => p.numero)).toEqual(["001", "003", "004", "002"]);
  expect(resultado[3]).toBe(outra);
});

it.each([0, 1, 121, 2.5, Number.NaN])("rejeita quantidade inválida: %s", quantidade => {
  expect(() => dividirParcelaCartao([parcela], 0, quantidade, cartoes)).toThrow(/2 a 120/);
});
it.each(["", "0", "0.03", "1.001", "abc", "1e3", "-20"])("rejeita valor sem precisão ou insuficiente: %s", valor => {
  expect(() => dividirParcelaCartao([{ ...parcela, valor }], 0, 4, cartoes)).toThrow();
});
it("preserva bloqueios, cartão ativo e data válida", () => {
  expect(() => dividirParcelaCartao([{ ...parcela, bloqueada: true }], 0, 4, cartoes)).toThrow(/edição/);
  expect(() => dividirParcelaCartao([parcela], 0, 4, [])).toThrow(/cartão/);
  expect(() => dividirParcelaCartao([{ ...parcela, dataCompra: "2026-02-30" }], 0, 4, cartoes)).toThrow(/data/);
});

it("respeita o limite total de parcelas da edição aceita", () => {
  const existentes = Array.from({ length: 120 }, (_, i) => ({ ...parcela, id: String(i), numero: String(i + 1) }));
  expect(() => dividirParcelaCartao(existentes, 0, 2, cartoes)).toThrow(/até 120 parcelas/);
});
