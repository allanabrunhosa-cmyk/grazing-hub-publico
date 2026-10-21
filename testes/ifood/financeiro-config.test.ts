import { describe, expect, it } from "vitest";
import { validarFinanceiroConfigIfood, vencimentoPrevistoIfood } from "@/lib/ifood/financeiro-config";
describe("Parametrização prévia do financeiro iFood", () => {
  it("calcula previsão configurada sem confundir com liquidação", () => { const c = validarFinanceiroConfigIfood({ prazoDias: 2, contagem: "UTEIS", formas: { IFOOD_ONLINE: "recebivel" } }); expect(vencimentoPrevistoIfood("2026-10-09", c).toISOString()).toBe("2026-10-13T12:00:00.000Z"); expect(vencimentoPrevistoIfood("2026-10-09", { ...c, contagem: "CORRIDOS" }).toISOString()).toBe("2026-10-11T12:00:00.000Z"); });
  it("rejeita prazo e mapeamento inválidos", () => { for (const prazoDias of [-1, 1.5, 3651, "2"]) expect(() => validarFinanceiroConfigIfood({ prazoDias, contagem: "UTEIS", formas: {} })).toThrow(); expect(() => validarFinanceiroConfigIfood({ prazoDias: 1, contagem: "UTEIS", formas: { INVENTADO: "forma" } })).toThrow(); });
});
