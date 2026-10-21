import { describe, expect, it } from "vitest";
import { diaUtilBancarioNacional, expedienteBancarioNacional, feriadosBancariosNacionais } from "@/lib/vendas/calendario-bancario";
import { vencimentoPrazoPedido } from "@/lib/vendas/pedidos-data-compra";

describe("Calendário bancário nacional CMN4.880", () => {
  // Fonte primária: FEBRABAN, calendário2026 publicado em13/01/2026.
  // https://portal.febraban.org.br/noticia/4413/pt-br/
  it("confere todas as13datas publicadas para2026", () => {
    const dias = ["01-01", "02-16", "02-17", "04-03", "04-21", "05-01", "06-04", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map(d => "2026-" + d);
    expect(feriadosBancariosNacionais(2026).map(f => f.dia)).toEqual(dias);
    for (const d of dias) expect(diaUtilBancarioNacional(d)).toBe(false);
  });
  it("confere móveis do calendário2025 publicado pelaFEBRABAN", () => {
    expect(feriadosBancariosNacionais(2025).filter(f => f.natureza === "BANCARIO").map(f => f.dia)).toEqual(["2025-03-03", "2025-03-04", "2025-04-18", "2025-06-19"]);
  });
  it("distingue ponto facultativo, expediente especial e feriado bancário", () => {
    expect(expedienteBancarioNacional("2026-02-18")).toBe("REDUZIDO");
    expect(diaUtilBancarioNacional("2026-02-18")).toBe(true);
    expect(expedienteBancarioNacional("2026-12-24")).toBe("REDUZIDO");
    expect(expedienteBancarioNacional("2026-12-31")).toBe("SEM_ATENDIMENTO_PUBLICO");
    expect(diaUtilBancarioNacional("2026-12-31")).toBe(true);
    expect(expedienteBancarioNacional("2026-10-28")).toBe("NORMAL");
    expect(expedienteBancarioNacional("2026-07-09")).toBe("NORMAL"); // Feriado estadual não é nacional.
  });
  it("não aplica retroativamente o feriado nacional20/11", () => {
    expect(diaUtilBancarioNacional("2023-11-20")).toBe(true);
    expect(diaUtilBancarioNacional("2024-11-20")).toBe(false);
  });
  it.each([
    ["2026-02-13", 1, "2026-02-18"], ["2026-04-02", 1, "2026-04-06"],
    ["2026-06-03", 1, "2026-06-05"], ["2026-11-19", 1, "2026-11-23"],
    ["2026-12-30", 2, "2027-01-04"],
  ])("conta prazo configurado de%s por%d úteis até%s", (compra, prazoDias, esperado) => {
    expect(vencimentoPrazoPedido({ prazoDias, inicioPrazo: "VENDA", contagemPrazo: "UTEIS", vencimentoFlexivel: false }, compra)).toBe(esperado);
  });
});
