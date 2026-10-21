import { expect, it } from "vitest";
import { calcularPlanilhaFluxoCaixa, montarArvoreFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { lancamentoTeste } from "./dados-movimentacoes";
const periodo = { de: "2026-09-01", ate: "2026-09-30" };
const plano = [
  { id: "sem-receita", nome: "Receitas financeiras", grupo: "RECEITAS_NAO_OPERACIONAIS" as const },
  { id: "sem-despesa", nome: "Despesas operacionais › Limpeza", grupo: "DESPESAS_OPERACIONAIS" as const },
];
it("exibe categorias sem atividade em ambos os tipos mesmo num período vazio", () => {
  const p = calcularPlanilhaFluxoCaixa(1000, [], periodo, undefined, plano);
  expect(p.receitas[0].categorias[0]).toMatchObject({ categoriaId: "sem-receita", total: 0, porDia: {} });
  expect(p.despesas[0].categorias[0]).toMatchObject({ categoriaId: "sem-despesa", total: 0, porDia: {} });
  expect(p.saldoFinal).toBe(1000);
});
it("não duplica lançamentos ou muda saldos ao incluir o plano completo", () => {
  const lancamento = lancamentoTeste({ id: "pago", categoriaId: "sem-despesa", categoriaGrupo: "DESPESAS_OPERACIONAIS", valor: 125, status: "BAIXADO", dataPagamento: "2026-09-10", dataVencimento: "2026-09-10" });
  const legado = { ...lancamento, id: "historico", categoriaId: "excluida", categoriaNome: "Categoria histórica", valor: 25 };
  const dados = [lancamento, legado];
  const anterior = calcularPlanilhaFluxoCaixa(1000, dados, periodo);
  const atual = calcularPlanilhaFluxoCaixa(1000, dados, periodo, undefined, plano);
  expect(atual.totalDespesasGeral).toBe(150);
  expect(atual.saldoPorDia).toEqual(anterior.saldoPorDia);
  expect(atual.despesas[0].categorias.find(c => c.categoriaId === "sem-despesa")?.porDia["2026-09-10"].lancamentoIds).toEqual(["pago"]);
  expect(atual.despesas[0].categorias.some(c => c.categoriaId === "excluida")).toBe(true);
});

it("organiza três níveis, agrega valores diretos e descendentes sem mudar totais originais", () => {
  const categorias = [
    { id: "pai", nome: "Pessoal", grupo: "DESPESAS_OPERACIONAIS" as const },
    { id: "filho", nome: "Pessoal › Benefícios", grupo: "DESPESAS_OPERACIONAIS" as const, paiId: "pai" },
    { id: "neto", nome: "Pessoal › Benefícios › Alimentação", grupo: "DESPESAS_OPERACIONAIS" as const, paiId: "filho" },
  ];
  const dados = [lancamentoTeste({ id: "direto", categoriaId: "pai", categoriaGrupo: "DESPESAS_OPERACIONAIS", valor: 10, dataVencimento: "2026-09-10" }), lancamentoTeste({ id: "neto-lancamento", categoriaId: "neto", categoriaGrupo: "DESPESAS_OPERACIONAIS", valor: 30, dataVencimento: "2026-09-10" })];
  const p = calcularPlanilhaFluxoCaixa(0, dados, periodo, undefined, categorias);
  const arvore = montarArvoreFluxoCaixa(p.despesas[0].categorias);
  expect(arvore).toHaveLength(1);
  expect(arvore[0].total).toBe(40);
  expect(arvore[0].filhos[0].total).toBe(30);
  expect(arvore[0].filhos[0].filhos[0].categoriaId).toBe("neto");
  expect(arvore[0].porDia["2026-09-10"].lancamentoIds).toEqual(["direto", "neto-lancamento"]);
  expect(p.totalDespesasGeral).toBe(40);
  expect(p.despesas[0].categorias.find(c => c.categoriaId === "pai")?.total).toBe(10);
});
