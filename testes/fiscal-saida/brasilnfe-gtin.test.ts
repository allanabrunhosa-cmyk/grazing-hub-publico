import { describe, expect, it } from "vitest";
import { aceitaEdicaoGtinFiscalBrasilNfe, gtinFiscalBrasilNfeValido } from "@/lib/fiscal-saida/brasilnfe/gtin";

describe("GTIN local — códigos exclusivamente sintéticos, sem consulta GS1", () => {
  it.each(["12345670", "123456789012", "1234567890128", "12345678901231", "0123456789012"])("confere formato e dígito sem alterar o texto %s", gtin => {
    expect(gtinFiscalBrasilNfeValido(gtin)).toBe(true);
    expect(gtinFiscalBrasilNfeValido(gtin.slice(0, -1) + (Number(gtin.at(-1)) + 1) % 10)).toBe(false);
  });
  it.each([undefined, null, 12345670, {}, ["12345670"], "", "SEMGTIN", "sem gtin", " SEM GTIN", "SEM GTIN ", "1234567", "123456789", "12345678901", "123456789012345", "1234567X", "12345670\n", "12345670\u0000"])("recusa tipo ou formato sem inferir ausência de GTIN: %s", valor => {
    expect(gtinFiscalBrasilNfeValido(valor)).toBe(false);
  });
  it("SEM GTIN exige declaração textual explícita", () => { expect(gtinFiscalBrasilNfeValido("SEM GTIN")).toBe(true); expect(gtinFiscalBrasilNfeValido("SEM")).toBe(false); });
  it.each([8, 12, 13, 14])("zeros com tamanho%s não são GTIN nem declaração de inexistência", tamanho => { expect(gtinFiscalBrasilNfeValido("0".repeat(tamanho))).toBe(false); });
  it.each(["", "1", "01234567890123", "S", "SE", "SEM ", "SEM GT", "SEM GTIN"])("permite edição parcial %s sem afirmar validade final", valor => { expect(aceitaEdicaoGtinFiscalBrasilNfe(valor)).toBe(true); });
  it.each(["Produto 123", "SEN", "SEMGTIN", "SEM GTINX", "123456789012345", "123X", "SEM GTIN\n", "12345670\u0000"])("recusa digitação/colagem incompatível %s", valor => { expect(aceitaEdicaoGtinFiscalBrasilNfe(valor)).toBe(false); });
});
