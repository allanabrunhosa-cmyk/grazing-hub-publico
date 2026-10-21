import { expect, it } from "vitest";
import { calcularSaldoContasAte, type SaldoInicialConta } from "@/lib/financeiro/saldos-iniciais";
import { calcularExtrato, montarLinhasExtrato } from "@/lib/financeiro/extrato";
import { calcularPlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { lancamentoTeste } from "./dados-movimentacoes";

const contas: SaldoInicialConta[] = [{ id: "a", saldoInicial: 1000, dataSaldoInicial: "2026-09-10" }, { id: "b", saldoInicial: 200, dataSaldoInicial: null }];
const movimentos = [
  { contaBancariaId: "a", data: "2026-09-09", valor: 500 },
  { contaBancariaId: "b", data: "2026-09-09", valor: -50 },
  { contaBancariaId: "a", data: "2026-09-10", valor: -100.10 },
  { contaBancariaId: "a", data: "2026-09-11", valor: -0.20 },
];
it("não antecipa a abertura e não duplica histórico anterior; inclui movimentos do mesmo dia", () => {
  expect(calcularSaldoContasAte(contas, movimentos, "2026-09-09")).toBe(650);
  expect(calcularSaldoContasAte(contas, movimentos, "2026-09-10")).toBe(1049.9);
  expect(calcularSaldoContasAte(contas, movimentos, "2026-09-11")).toBe(1049.7);
});
it("respeita bases independentes, negativa e futuras, e preserva contas antigas", () => {
  expect(calcularSaldoContasAte([{ ...contas[0], saldoInicial: -10, dataSaldoInicial: "2026-09-11" }, { ...contas[1], dataSaldoInicial: "2026-09-12" }], movimentos, "2026-09-11")).toBe(-60.2);
  expect(calcularSaldoContasAte(contas.map((c) => ({ ...c, dataSaldoInicial: null })), movimentos, "2026-09-11")).toBe(1549.7);
});
it("extrato mostra abertura sem movimentos, não soma como receita e inclui todas as contas", () => {
  const linhas = montarLinhasExtrato([], movimentos.map((m, i) => ({ id: String(i), tipo: "AJUSTE", valor: m.valor, data: m.data, descricao: "Teste", contaBancariaId: m.contaBancariaId, contaBancariaNome: m.contaBancariaId })));
  const extrato = calcularExtrato(linhas, 1200, { de: "2026-09-01", ate: "2026-09-30" }, "BAIXADO", contas);
  expect(extrato.saldoFinal).toBe(1049.7);
  expect(extrato.entradas).toBe(500);
  expect(extrato.saidas).toBe(150.3);
  expect(extrato.dias.find((d) => d.data === "2026-09-10")?.temSaldoInicial).toBe(true);
  expect(calcularExtrato([], 999, { de: "2026-09-10", ate: "2026-09-10" }, "PENDENTE", contas)).toMatchObject({ saldoAnterior: 200, saldoFinal: 1200, entradas: 0, saidas: 0, dias: [{ data: "2026-09-10", linhas: [], saldo: 1200, temSaldoInicial: true }] });
});
it("fluxo de caixa e extrato respeitam as mesmas datas e mantêm o histórico nas categorias", () => {
  const lancamentos = movimentos.map((m, i) => lancamentoTeste({ id: String(i), contaBancariaId: m.contaBancariaId, status: "BAIXADO", dataPagamento: m.data, dataVencimento: m.data, tipo: m.valor < 0 ? "DESPESA" : "RECEITA", valor: Math.abs(m.valor) }));
  const periodo = { de: "2026-09-09", ate: "2026-09-12" };
  const fluxo = calcularPlanilhaFluxoCaixa(1200, lancamentos, periodo, contas);
  expect(fluxo.saldoPorDia["2026-09-09"]).toBe(650);
  expect(fluxo.saldoPorDia["2026-09-10"]).toBeCloseTo(1049.9, 2);
  expect(fluxo.saldoFinal).toBeCloseTo(1049.7, 2);
  expect(fluxo.totalReceitasGeral).toBe(500);
  expect(calcularExtrato(montarLinhasExtrato(lancamentos, []), 1200, periodo, "TUDO", contas).saldoFinal).toBeCloseTo(fluxo.saldoFinal, 2);
});
it("uma nova data recalcula a base e pendências sem conta continuam projetadas", () => {
  const linhas = montarLinhasExtrato([lancamentoTeste({ contaBancariaId: null, valor: 50, dataVencimento: "2026-09-01" })], []);
  expect(calcularExtrato(linhas, 1200, { de: "2026-09-10", ate: "2026-09-30" }, "PENDENTE", contas).saldoFinal).toBe(1150);
  expect(calcularSaldoContasAte([{ ...contas[0], dataSaldoInicial: "2026-09-12" }, contas[1]], movimentos, "2026-09-12")).toBe(1150);
});
