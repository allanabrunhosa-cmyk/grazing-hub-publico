import { expect, it } from "vitest";
import { valoresCompetenciaPedidos, type OrigemCompetenciaPedido } from "@/lib/financeiro/competencia-pedidos";
import { calcularDre } from "@/lib/financeiro/calcularDre";
const pedido: OrigemCompetenciaPedido = { id: "p", versaoFinanceiro: 1, status: "CONFIRMADO", total: "300", entregueEm: null, tratamentosFinanceiros: [], movimentosCreditoAplicado: [] };
const titulo = (id: string, valor: string, origem = pedido) => ({ id, tipo: "RECEITA", status: "BAIXADO", valor, pedidoEfeitoChave: "parcela:1", pedidoVenda: origem });
it("revê competência original sem alterar caixa e sem replicar dedução na devolução", () => {
  const cancelado = { ...pedido, status: "CANCELADO" };
  const entrada = titulo("entrada", "300", cancelado);
  const saida = { ...titulo("saida", "300", cancelado), tipo: "DESPESA", pedidoEfeitoChave: "devolucao:1" };
  const valores = valoresCompetenciaPedidos([entrada, saida]);
  expect([...valores.values()]).toEqual([0, 0]);
  const linhas = [entrada, saida].map(t => ({ valor: Number(t.valor), valorCompetencia: valores.get(t.id), status: "BAIXADO" as const, dataCompetencia: "2026-09-20", dataPagamento: t.id === "entrada" ? "2026-10-01" : "2026-11-01", categoriaId: t.id, categoriaNome: t.id, categoriaGrupo: t.id === "entrada" ? "RECEITA_BRUTA" as const : "DEDUCOES_RECEITA" as const }));
  const periodo = (mes: string) => ({ de: new Date(`2026-${mes}-01`), ate: new Date(`2026-${mes}-28T23:59:59Z`) });
  expect(calcularDre(linhas, periodo("09"), "COMPETENCIA").resultadoLiquido).toBe(0);
  expect(calcularDre(linhas, periodo("10"), "CAIXA").resultadoLiquido).toBe(300);
  expect(calcularDre(linhas, periodo("11"), "CAIXA").resultadoLiquido).toBe(-300);
});
it("distingue pós-venda de excesso de revisão mesmo após entregar, conserva centavos", () => {
  const p = { ...pedido, total: "100.01", entregueEm: new Date(), tratamentosFinanceiros: [
    { status: "CONCLUIDA", valor: "200", retido: "0", reduzVenda: false },
    { status: "SOLICITADA", valor: "20", retido: "0", reduzVenda: true },
    { status: "CANCELADA", valor: "30", retido: "0", reduzVenda: true },
  ] };
  const v = valoresCompetenciaPedidos([titulo("a", "100", p), titulo("b", "100", p), titulo("c", "100", p)]);
  expect([...v.values()]).toEqual([26.67, 26.67, 26.67]);
  expect(valoresCompetenciaPedidos([titulo("a", "300", { ...p, versaoFinanceiro: 0 })]).size).toBe(0);
});
it("retenção explícita conserva somente o retido; restaurar crédito não produz caixa", () => {
  const p = { ...pedido, status: "CANCELADO", tratamentosFinanceiros: [{ status: "CONCLUIDA", valor: "270", retido: "30", reduzVenda: false }] };
  expect(valoresCompetenciaPedidos([titulo("a", "300", p)]).get("a")).toBe(30);
  const entregue = { ...pedido, movimentosCreditoAplicado: [{ tipo: "LIBERACAO", valor: "90", reduzVenda: true }] };
  expect(valoresCompetenciaPedidos([titulo("b", "300", entregue)]).get("b")).toBe(210);
});
