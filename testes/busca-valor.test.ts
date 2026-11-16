import { describe, expect, it } from "vitest";
import { correspondeBuscaValor, valorDaBusca, valoresDecimaisDaBusca } from "@/lib/busca-valor";

describe("Busca compartilhada por valor monetário", () => {
  it.each(["308", "308,00", "308.00", "R$ 308,00", " 308,0 "])("encontra valor completo em %s", termo => {
    expect(correspondeBuscaValor(termo, 308)).toBe(true);
    expect(correspondeBuscaValor(termo, -308)).toBe(true);
    expect(correspondeBuscaValor(termo, 1308)).toBe(false);
    expect(correspondeBuscaValor(termo, 308.01)).toBe(false);
  });
  it.each(["1.234,56", "1234,56", "1234.56", "R$ 1.234,56"])("mantém centavos e milhares em %s", termo => {
    expect(correspondeBuscaValor(termo, 1234.56)).toBe(true);
    expect(valoresDecimaisDaBusca(termo)).toEqual(["1234.56", "-1234.56"]);
  });
  it("preserva sinal explícito, centavos baixos e zero", () => {
    expect(correspondeBuscaValor("-R$ 8,01", -8.01)).toBe(true);
    expect(correspondeBuscaValor("-8,01", 8.01)).toBe(false);
    expect(correspondeBuscaValor("+8,01", -8.01)).toBe(false);
    expect(valoresDecimaisDaBusca("8")).toEqual(["8.00", "-8.00"]);
    expect(valoresDecimaisDaBusca("-8,01")).toEqual(["-8.01"]);
    expect(valoresDecimaisDaBusca("+8,01")).toEqual(["8.01"]);
    expect(valoresDecimaisDaBusca("0,01")).toEqual(["0.01", "-0.01"]);
    expect(valoresDecimaisDaBusca("0")).toEqual(["0.00"]);
    expect(correspondeBuscaValor("-0", 0)).toBe(true);
  });
  it.each(["", " ", "NF 308", "R$ NaN", "308,001", "1234.567", "1,234.56", "30,80,00", "Infinity", "1e3", "9999999999999999999"])("não interpreta termo inválido %s", termo => {
    expect(valorDaBusca(termo)).toBeNull();
    expect(valoresDecimaisDaBusca(termo)).toEqual([]);
    expect(correspondeBuscaValor(termo, 308, Number.NaN, Infinity)).toBe(false);
  });
});
