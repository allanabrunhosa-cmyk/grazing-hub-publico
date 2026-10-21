import { describe, expect, it } from "vitest";
import { resumoParcelamento } from "@/lib/vendas/pedidos-parcelamento";
describe("Apresentação das parcelas em centavos", () => {
  it("apresenta valor da parcela e total", () => expect(resumoParcelamento("300.00", 3)).toBe("3x de R$ 100,00 · Total R$ 300,00"));
  it("identifica o ajuste de centavos sem alterar total", () => expect(resumoParcelamento("10.00", 3)).toBe("3x de R$ 3,34* · Total R$ 10,00"));
  it("não calcula com entrada ou precisão inválida", () => { expect(resumoParcelamento("10.001", 3)).toBe("3x"); expect(resumoParcelamento("10.00", 0)).toBe("0x"); });
});
