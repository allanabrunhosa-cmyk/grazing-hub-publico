import { describe, expect, it } from "vitest";
import { calcularPlanilhaFluxoCaixa, montarArvoreFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { completarMesesFluxoCaixa, consolidarPlanilhaFluxoCaixaPorMes } from "@/lib/financeiro/fluxoCaixaMensal";
import { projetarCaixaFatura } from "@/lib/financeiro/faturas/projecoes";
import { lancamentoTeste } from "./dados-movimentacoes";

describe("limites do fluxo mensal", () => {
  it.each([
    ["2026-09-15", "2026-10-10", "2026-09-01", "2026-10-31"],
    ["2024-02-10", "2024-02-20", "2024-02-01", "2024-02-29"],
    ["2025-12-20", "2026-01-05", "2025-12-01", "2026-01-31"],
    ["", "2026-09-10", "", "2026-09-30"],
    ["2026-09-10", "", "2026-09-01", ""],
  ])("completa os meses de %s até %s", (de, ate, inicio, fim) => {
    expect(completarMesesFluxoCaixa({ de, ate })).toEqual({ de: inicio, ate: fim });
  });

  it.each(["2026-02-31", "2026-00-03", "2026-02", "0000-01-01"])("preserva o limite inválido %s", de => {
    expect(completarMesesFluxoCaixa({ de, ate: "2026-09-10" })).toEqual({ de, ate: "2026-09-30" });
  });

  it.each([
    { de: "2026-09-20", ate: "2026-09-10" },
    { de: "2026-10-01", ate: "2026-09-30" },
  ])("não corrige silenciosamente intervalo invertido", periodo => {
    expect(completarMesesFluxoCaixa(periodo)).toEqual(periodo);
  });
});

const periodo = { de: "2026-09-01", ate: "2026-11-30" };
const plano = [
  { id: "vendas", nome: "Vendas", grupo: "RECEITA_BRUTA" as const },
  { id: "pai", nome: "Pessoal", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "filho", nome: "Pessoal › Benefícios", grupo: "DESPESAS_OPERACIONAIS" as const, paiId: "pai" },
  { id: "vazio", nome: "Limpeza", grupo: "DESPESAS_OPERACIONAIS" as const },
];

function calcularOrigem() {
  return calcularPlanilhaFluxoCaixa(100, [
    lancamentoTeste({ id: "receita-centavos-1", tipo: "RECEITA", categoriaId: "vendas", categoriaGrupo: "RECEITA_BRUTA", valor: 0.1, status: "BAIXADO", dataPagamento: "2026-09-01", dataVencimento: "2026-09-01" }),
    lancamentoTeste({ id: "receita-centavos-2", tipo: "RECEITA", categoriaId: "vendas", categoriaGrupo: "RECEITA_BRUTA", valor: 0.2, dataVencimento: "2026-09-30" }),
    lancamentoTeste({ id: "direto", categoriaId: "pai", valor: 10, status: "BAIXADO", dataPagamento: "2026-09-01", dataVencimento: "2026-09-01" }),
    lancamentoTeste({ id: "descendente", categoriaId: "filho", valor: 25, dataVencimento: "2026-09-30" }),
    lancamentoTeste({ id: "pago-em-outubro", tipo: "RECEITA", categoriaId: "vendas", categoriaGrupo: "RECEITA_BRUTA", valor: 40, status: "BAIXADO", dataPagamento: "2026-10-01", dataVencimento: "2026-09-20" }),
    lancamentoTeste({ id: "credito-cliente", tipo: "RECEITA", categoriaId: "vendas", categoriaGrupo: "RECEITA_BRUTA", valor: 1000, status: "BAIXADO", dataPagamento: "2026-09-01", pedidoQuitadoCredito: true }),
  ], periodo, undefined, plano);
}

describe("consolidação do fluxo de caixa por mês", () => {
  it("soma centavos, respeita datas efetivas e mantém mês sem movimentação", () => {
    const origem = calcularOrigem();
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(origem);
    expect(mensal.dias).toEqual(["2026-09-30", "2026-10-31", "2026-11-30"]);
    expect(mensal.totalReceitasPorDia).toEqual({ "2026-09-30": 0.3, "2026-10-31": 40, "2026-11-30": 0 });
    expect(mensal.totalDespesasPorDia).toEqual({ "2026-09-30": 35, "2026-10-31": 0, "2026-11-30": 0 });
    expect(mensal.saldoPorDia).toEqual(Object.fromEntries(mensal.dias.map(dia => [dia, origem.saldoPorDia[dia]])));
    expect(mensal.saldoPorDia["2026-09-30"]).toBeCloseTo(65.3, 2);
    expect(mensal.saldoPorDia["2026-11-30"]).toBeCloseTo(105.3, 2);
    expect(mensal.totalReceitasGeral).toBe(origem.totalReceitasGeral);
    expect(mensal.totalDespesasGeral).toBe(origem.totalDespesasGeral);
    expect(mensal.saldoFinal).toBe(origem.saldoFinal);
  });

  it("preserva IDs, projeções e hierarquia sem duplicar totais dos ramos", () => {
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(calcularOrigem());
    expect(mensal.receitas[0].porDia["2026-09-30"]).toEqual({
      valor: 0.3, lancamentoIds: ["receita-centavos-1", "receita-centavos-2"], temPendente: true,
    });
    expect(mensal.receitas[0].porDia["2026-10-31"].temPendente).toBe(false);
    const grupo = mensal.despesas[0];
    expect(grupo.categorias.find(categoria => categoria.categoriaId === "vazio")).toMatchObject({ total: 0, porDia: {} });
    expect(grupo.categorias.find(categoria => categoria.categoriaId === "filho")?.paiId).toBe("pai");
    expect(grupo.categorias.find(categoria => categoria.categoriaId === "pai")?.total).toBe(10);
    const pai = montarArvoreFluxoCaixa(grupo.categorias).find(categoria => categoria.categoriaId === "pai")!;
    expect(pai.total).toBe(35);
    expect(pai.porDia["2026-09-30"]).toEqual({ valor: 35, lancamentoIds: ["direto", "descendente"], temPendente: true });
    expect(mensal.totalDespesasGeral).toBe(35);
  });

  it("não altera a origem nem compartilha células e listas de IDs", () => {
    const origem = calcularOrigem();
    const anterior = structuredClone(origem);
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(origem);
    mensal.receitas[0].porDia["2026-09-30"].valor = 9;
    mensal.receitas[0].porDia["2026-09-30"].lancamentoIds.push("outro");
    mensal.receitas[0].categorias[0].porDia["2026-09-30"].lancamentoIds.push("outro");
    mensal.despesas[0].categorias[0].total = 9;
    mensal.dias.push("2026-12-31");
    expect(origem).toEqual(anterior);
  });

  it("fecha fevereiro bissexto e mantém dezembro e janeiro em anos diferentes", () => {
    const origem = calcularPlanilhaFluxoCaixa(10, [], { de: "2023-12-01", ate: "2024-02-29" });
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(origem);
    expect(mensal.dias).toEqual(["2023-12-31", "2024-01-31", "2024-02-29"]);
    expect(Object.values(mensal.saldoPorDia)).toEqual([10, 10, 10]);
  });

  it("aplica saldo inicial datado uma vez e não o transforma em receita", () => {
    const origem = calcularPlanilhaFluxoCaixa(500, [
      lancamentoTeste({ id: "historico", contaBancariaId: "conta", tipo: "RECEITA", categoriaGrupo: "RECEITA_BRUTA", valor: 200, status: "BAIXADO", dataPagamento: "2026-08-01", dataVencimento: "2026-08-01" }),
      lancamentoTeste({ id: "entrada", contaBancariaId: "conta", tipo: "RECEITA", categoriaGrupo: "RECEITA_BRUTA", valor: 50, status: "BAIXADO", dataPagamento: "2026-09-20", dataVencimento: "2026-09-20" }),
      lancamentoTeste({ id: "saida", contaBancariaId: "conta", valor: 25, status: "BAIXADO", dataPagamento: "2026-10-01", dataVencimento: "2026-10-01" }),
    ], periodo, [{ id: "conta", saldoInicial: 500, dataSaldoInicial: "2026-09-15" }]);
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(origem);
    expect(mensal.saldoPorDia).toEqual({ "2026-09-30": 550, "2026-10-31": 525, "2026-11-30": 525 });
    expect(mensal.totalReceitasGeral).toBe(50);
    expect(mensal.totalReceitasPorDia["2026-09-30"]).toBe(50);
  });

  it("conserva fatura parcial com pagamento em outro mês sem segunda despesa", () => {
    const linhas = projetarCaixaFatura(lancamentoTeste({ valor: 80, dataVencimento: "2026-09-20" }), {
      faturaId: "fatura", cartao: "Cartão sintético", liquidacoes: [{
        id: "liquidacao", valor: 30, pagamento: { id: "pagamento", data: "2026-10-20", contaIdOriginal: "conta", revertidoEm: null },
      }],
    });
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(calcularPlanilhaFluxoCaixa(100, linhas, periodo));
    expect(mensal.totalDespesasPorDia).toEqual({ "2026-09-30": 50, "2026-10-31": 30, "2026-11-30": 0 });
    expect(mensal.totalDespesasGeral).toBe(80);
    expect(mensal.saldoFinal).toBe(20);
    expect(mensal.despesas[0].porDia["2026-09-30"].lancamentoIds).toEqual(["fatura:aluguel:pendente"]);
    expect(mensal.despesas[0].porDia["2026-10-31"].lancamentoIds).toEqual(["fatura:aluguel:liquidacao"]);
  });

  it("mantém saldo e categorias quando a origem não possui colunas", () => {
    const origem = calcularPlanilhaFluxoCaixa(100, [], { de: "2026-09-20", ate: "2026-09-10" }, undefined, plano);
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(origem);
    expect(mensal).toEqual(origem);
    expect(mensal.dias).toEqual([]);
    expect(mensal.saldoFinal).toBe(100);
  });
});
