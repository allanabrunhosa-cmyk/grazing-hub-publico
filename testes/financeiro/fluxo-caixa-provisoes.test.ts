import { describe, expect, it } from "vitest";
import { calcularPlanilhaFluxoCaixa, montarArvoreFluxoCaixa, situacaoNoFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { consolidarPlanilhaFluxoCaixaPorMes } from "@/lib/financeiro/fluxoCaixaMensal";
import { lancamentoTeste } from "./dados-movimentacoes";

const hoje = "2026-09-10";
const periodo = { de: "2026-09-01", ate: "2026-10-31" };
const calcular = (dados: ReturnType<typeof lancamentoTeste>[], limites = periodo) =>
  calcularPlanilhaFluxoCaixa(1000, dados, limites, undefined, [], hoje);

describe("situação do lançamento no fluxo de caixa", () => {
  it.each([
    ["BAIXADO", "2026-09-01", "REALIZADO"],
    ["PENDENTE", "2026-09-09", "NAO_REALIZADO"],
    ["PENDENTE", "2026-09-10", "PROVISAO"],
    ["PENDENTE", "2026-09-11T12:00:00Z", "PROVISAO"],
  ] as const)("%s com vencimento %s é %s", (status, dataVencimento, esperado) => {
    expect(situacaoNoFluxoCaixa({ status, dataVencimento }, hoje)).toBe(esperado);
  });
});

describe("saldo do fluxo de caixa: realizado, provisão e pagamento não realizado", () => {
  const dados = [
    lancamentoTeste({ id: "pago", valor: 100, status: "BAIXADO", dataPagamento: "2026-09-05", dataVencimento: "2026-09-03" }),
    lancamentoTeste({ id: "vencido", valor: 40, dataVencimento: "2026-09-08" }),
    lancamentoTeste({ id: "receita-vencida", tipo: "RECEITA", categoriaId: "vendas", categoriaGrupo: "RECEITA_BRUTA", valor: 70, dataVencimento: "2026-09-09" }),
    lancamentoTeste({ id: "vence-hoje", valor: 10, dataVencimento: "2026-09-10" }),
    lancamentoTeste({ id: "provisao", valor: 25, dataVencimento: "2026-10-02" }),
  ];

  it("pendente vencido não altera saldo nem totais e continua visível na célula", () => {
    const p = calcular(dados);
    expect(p.saldoPorDia["2026-09-09"]).toBe(900);
    expect(p.totalDespesasPorDia["2026-09-08"]).toBe(0);
    expect(p.totalReceitasGeral).toBe(0);
    expect(p.despesas[0].porDia["2026-09-08"]).toEqual({ valor: 0, lancamentoIds: ["vencido"], temProvisao: false, naoRealizado: 40 });
    expect(p.receitas[0].porDia["2026-09-09"]).toMatchObject({ valor: 0, naoRealizado: 70 });
    expect(p.totalDespesasGeral).toBe(135);
    expect(p.saldoFinal).toBe(865);
  });

  it("provisão entra no saldo a partir do vencimento e marca movimentação e saldo", () => {
    const p = calcular(dados);
    expect(p.saldoComProvisao["2026-09-09"]).toBe(false);
    expect(p.saldoPorDia["2026-09-10"]).toBe(890);
    expect(p.saldoComProvisao["2026-09-10"]).toBe(true);
    expect(p.despesas[0].porDia["2026-09-10"]).toEqual({ valor: 10, lancamentoIds: ["vence-hoje"], temProvisao: true, naoRealizado: 0 });
    expect(p.despesas[0].porDia["2026-09-05"].temProvisao).toBe(false);
    expect(p.saldoComProvisao["2026-10-01"]).toBe(true);
    expect(p.saldoPorDia["2026-10-02"]).toBe(865);
    expect(p.saldoFinalComProvisao).toBe(true);
  });

  it("sem provisão o saldo não é marcado", () => {
    const p = calcular(dados.slice(0, 3));
    expect(Object.values(p.saldoComProvisao).some(Boolean)).toBe(false);
    expect(p.saldoFinalComProvisao).toBe(false);
    expect(p.saldoFinal).toBe(900);
  });

  it("antes do período: vencido fica fora da base e provisão anterior marca o saldo desde o início", () => {
    const p = calcular(dados, { de: "2026-10-05", ate: "2026-10-06" });
    expect(p.saldoPorDia).toEqual({ "2026-10-05": 865, "2026-10-06": 865 });
    expect(p.saldoComProvisao).toEqual({ "2026-10-05": true, "2026-10-06": true });
  });

  it("mês e hierarquia preservam provisão e pagamento não realizado", () => {
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(calcular(dados));
    expect(mensal.despesas[0].porDia["2026-09-30"]).toMatchObject({ valor: 110, temProvisao: true, naoRealizado: 40 });
    expect(mensal.saldoPorDia).toEqual({ "2026-09-30": 890, "2026-10-31": 865 });
    expect(mensal.saldoComProvisao).toEqual({ "2026-09-30": true, "2026-10-31": true });
    const no = montarArvoreFluxoCaixa(mensal.despesas[0].categorias)[0];
    expect(no.porDia["2026-09-30"]).toMatchObject({ valor: 110, naoRealizado: 40, temProvisao: true });
  });
});
