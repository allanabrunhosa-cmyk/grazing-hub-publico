import { describe, expect, it } from "vitest";
import { aplicarPeriodoPadrao, periodoMesAteHoje, completarPeriodo, mesesFechados, periodoUltimosDias, periodoDoAno, periodoDoMes } from "@/lib/financeiro/periodos";
import { calcularDre } from "@/lib/financeiro/calcularDre";
import { calcularPlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";

describe("períodos financeiros", () => {
  it.each([["2024-02", "2024-02-29"], ["2026-02", "2026-02-28"], ["2100-02", "2100-02-28"], ["2026-12", "2026-12-31"]])("fecha corretamente %s", (mes, ate) => {
    expect(periodoDoMes(mes)).toEqual({ de: `${mes}-01`, ate });
  });
  it("valida mês e ano sem aplicar datas incompletas", () => {
    expect(periodoDoMes("2026-13")).toBeNull();
    expect(periodoDoAno("202")).toBeNull();
    expect(periodoDoAno("0000")).toBeNull();
  });
  it("inclui o ano inteiro nos totais do DRE e do fluxo, incluindo 29/02", () => {
    const datas = ["2023-12-31", "2024-01-01", "2024-02-29", "2024-12-31", "2025-01-01"];
    const lancamentos = datas.map((data, indice) => ({
      id: String(indice), valor: 100, tipo: "RECEITA" as const, status: "BAIXADO" as const,
      categoriaId: "vendas", categoriaNome: "Vendas", categoriaGrupo: "RECEITA_BRUTA" as const,
      dataCompetencia: `${data}T12:00:00`, dataPagamento: `${data}T12:00:00`, dataVencimento: `${data}T12:00:00`,
    }));
    const ano = periodoDoAno("2024")!;
    const fluxo = calcularPlanilhaFluxoCaixa(0, lancamentos, ano);
    expect(fluxo.dias).toHaveLength(366);
    expect(fluxo.totalReceitasGeral).toBe(300);
    for (const modo of ["CAIXA", "COMPETENCIA"] as const) {
      expect(calcularDre(lancamentos, { de: new Date(`${ano.de}T00:00:00`), ate: new Date(`${ano.ate}T23:59:59.999`) }, modo).faturamentoBruto).toBe(300);
    }
    expect(calcularPlanilhaFluxoCaixa(0, lancamentos, periodoDoMes("2024-02")!).totalReceitasGeral).toBe(100);
  });
});


it("calcula os últimos dias incluindo hoje e atravessando a virada do ano", () => {
  expect(periodoUltimosDias(7, new Date(2026, 0, 3))).toEqual({ de: "2025-12-28", ate: "2026-01-03" });
  expect(periodoUltimosDias(30, new Date(2024, 2, 1))).toEqual({ de: "2024-02-01", ate: "2024-03-01" });
  expect(periodoUltimosDias(90, new Date(2026, 8, 11))).toEqual({ de: "2026-06-14", ate: "2026-09-11" });
});
it("lista apenas meses já fechados do ano corrente em ordem decrescente", () => {
  expect(mesesFechados(new Date(2026, 0, 10))).toEqual([]);
  const meses = mesesFechados(new Date(2026, 8, 11));
  expect(meses).toHaveLength(8);
  expect(meses[0]).toEqual({ valor: "2026-08", label: "Agosto de 2026" });
  expect(meses.at(-1)?.valor).toBe("2026-01");
});
it("limpar datas cobre todo o histórico e limites parciais continuam respeitados", () => {
  const datas = ["2025-12-31T12:00:00Z", "2026-10-01", null, "inválida"];
  expect(completarPeriodo({ de: "", ate: "" }, datas, "2026-09-11")).toEqual({ de: "2025-12-31", ate: "2026-10-01" });
  expect(completarPeriodo({ de: "2026-09-01", ate: "" }, datas, "2026-09-11")).toEqual({ de: "2026-09-01", ate: "2026-10-01" });
  expect(completarPeriodo({ de: "", ate: "2024-01-01" }, datas, "2026-09-11")).toEqual({ de: "2024-01-01", ate: "2024-01-01" });
  expect(completarPeriodo({ de: "", ate: "" }, [], "2026-09-11")).toEqual({ de: "2026-09-11", ate: "2026-09-11" });
  expect(completarPeriodo({ de: "2026-09-01", ate: "2026-09-30" }, datas, "2026-09-11")).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
});


describe("período inicial comum", () => {
  it.each([
    ["2026-09-30T15:00:00Z", "2026-09-01", "2026-09-30"],
    ["2026-10-01T01:00:00Z", "2026-09-01", "2026-09-30"],
    ["2026-01-01T03:00:00Z", "2026-01-01", "2026-01-01"],
    ["2024-02-29T15:00:00Z", "2024-02-01", "2024-02-29"],
  ])("usa o calendário brasileiro em %s", (instante, de, ate) => {
    expect(periodoMesAteHoje(new Date(instante))).toEqual({ de, ate });
  });
  it("aplica padrão somente na ausência das duas datas, preservando outros filtros", () => {
    const hoje = new Date("2026-09-18T15:00:00Z");
    expect(aplicarPeriodoPadrao({ busca: "exemplo", de: undefined, ate: undefined }, hoje)).toEqual({ busca: "exemplo", de: "2026-09-01", ate: "2026-09-18" });
    for (const filtro of [{ de: "", ate: "" }, { de: "2025-01-01" }, { ate: "2025-12-31" }, { de: "2025-01-01", ate: "2025-12-31" }]) {
      expect(aplicarPeriodoPadrao(filtro, hoje)).toEqual(filtro);
    }
  });
});
