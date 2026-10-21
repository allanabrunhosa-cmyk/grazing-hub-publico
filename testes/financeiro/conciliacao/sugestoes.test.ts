import { expect, it } from "vitest";
import { agruparParaConciliacao, sugerirConciliacoes } from "@/lib/financeiro/conciliacao/sugestoes";
import { lancamentoTeste } from "../dados-movimentacoes";
import type { ExtratoBancarioRow } from "@/lib/financeiro/conciliacao/types";
const nota = { id: "nota", numero: "123", serie: "1", fornecedorNome: "Horta da Serra" };
const linhas = [lancamentoTeste({ id: "a", valor: 100, notaFiscal: nota }), lancamentoTeste({ id: "b", valor: 25.55, notaFiscal: nota })];
const banco: ExtratoBancarioRow = { id: "banco", contaBancariaId: "conta", data: "2026-09-10", descricao: "PIX HORTA DA SERRA", valor: -125.55, conciliadaEm: null, conciliadaPorNome: null, identificador: "1", arquivo: "extrato.ofx", lancamentoIds: [], historico: [] };
const sugestoes = (dados = linhas, transacoes = [banco], baixar = true) => sugerirConciliacoes(agruparParaConciliacao(dados), transacoes, baixar);
it("quitação por crédito não oferece grupo nem sugestão de transação bancária", () => {
  const titulo = lancamentoTeste({ pedidoVendaId: "pedido", pedidoQuitadoCredito: true, tipo: "RECEITA", valor: 250, status: "BAIXADO", contaBancariaId: "conta", dataPagamento: "2026-09-10T12:00:00Z" });
  expect(agruparParaConciliacao([titulo])).toEqual([]);
  expect(sugestoes([titulo], [{ ...banco, valor: 250 }]).sugestoes.size).toBe(0);
});
it("pedido pendente exige recebimento na origem; pedido já recebido continua conciliável", () => {
  const titulo = lancamentoTeste({ valor: 125.55, pedidoVendaId: "pedido-ficticio" });
  expect(sugestoes([titulo]).sugestoes.size).toBe(0);
  expect(sugestoes([{ ...titulo, status: "BAIXADO", contaBancariaId: "conta", dataPagamento: "2026-09-10T12:00:00Z" }]).sugestoes.get("banco")?.ids).toEqual([titulo.id]);
});
it("agrupa pelo vínculo real da nota e sugere seu total, sem unir notas diferentes", () => {
  expect(agruparParaConciliacao(linhas)).toMatchObject([{ titulo: "Horta da Serra", subtitulo: "NF-e nº 123 · Série 1", valor: -125.55 }]);
  expect(sugestoes().sugestoes.get("banco")?.ids).toEqual(["a", "b"]);
  expect(agruparParaConciliacao([linhas[0], { ...linhas[1], notaFiscal: { ...nota, id: "outra" } }])).toHaveLength(2);
});
it("mostra uma única despesa com o total financeiro da nota, incluindo custos e descontos distribuídos", () => {
  const troppo = { id: "troppo", numero: "14902", serie: "1", fornecedorNome: "DMD TROPPO ALIMENTOS LTDA", parcela: { id: "duplicata-troppo", numero: "001", valor: 704.90 } };
  const despesas = [
    lancamentoTeste({ id: "mostarda", valor: 53, notaFiscal: troppo }),
    lancamentoTeste({ id: "geleia", valor: 106, notaFiscal: troppo }),
    lancamentoTeste({ id: "compota", valor: 583, notaFiscal: troppo }),
  ];
  const [grupo] = agruparParaConciliacao(despesas);
  expect(grupo).toMatchObject({
    titulo: "DMD TROPPO ALIMENTOS LTDA",
    subtitulo: "NF-e nº 14902 · Série 1",
    valor: -704.90,
    valorComponentes: -742,
  });
  expect(grupo.lancamentos.map(lancamento => lancamento.id).sort()).toEqual(["compota", "geleia", "mostarda"]);
});
it("separa parcelas da mesma nota mesmo quando vencem no mesmo dia", () => {
  const base = { id: "nota-parcelada", numero: "321", serie: "1", fornecedorNome: "Fornecedor" };
  const grupos = agruparParaConciliacao([
    lancamentoTeste({ id: "item-parcela-1", valor: 60, notaFiscal: { ...base, parcela: { id: "parcela-1", numero: "001", valor: 60 } } }),
    lancamentoTeste({ id: "item-parcela-2", valor: 40, notaFiscal: { ...base, parcela: { id: "parcela-2", numero: "002", valor: 40 } } }),
  ]);
  expect(grupos.map(grupo => grupo.valor)).toEqual([-60, -40]);
});
it("não sugere nota pelo valor de apenas um item", () => expect(sugestoes(linhas, [{ ...banco, valor: -100 }]).sugestoes.size).toBe(0));
it("duas notas com mesmo valor e data exigem revisão manual", () => {
  const resultado = sugestoes([...linhas, ...linhas.map(l => ({ ...l, id: l.id + "2", notaFiscal: { ...nota, id: "outra" } }))]);
  expect(resultado.sugestoes.size).toBe(0); expect(resultado.ambiguas.has("banco")).toBe(true);
});
it("a mesma nota não é sugerida para dois pagamentos concorrentes", () => {
  const resultado = sugestoes(linhas, [banco, { ...banco, id: "outro" }]);
  expect(resultado.sugestoes.size).toBe(0); expect(resultado.ambiguas.size).toBe(2);
});
it.each(["2026-09-03", "2026-09-06", "2026-09-14", "2026-09-17"])("sugere vencimento a até sete dias, para ambos os lados: %s", data => {
  expect(sugestoes(linhas, [{ ...banco, data }]).sugestoes.get("banco")).toMatchObject({ ids: ["a", "b"], motivo: expect.stringContaining("até 7 dias") });
});
it.each(["2026-09-02", "2026-09-18"])("não sugere vencimento a oito dias: %s", data => {
  expect(sugestoes(linhas, [{ ...banco, data }]).sugestoes.size).toBe(0);
});
it("na janela ampliada exige contraparte e valor exato em centavos", () => {
  for (const descricao of ["PIX PAGAMENTO", "PIX OUTRO FORNECEDOR"]) {
    expect(sugestoes(linhas, [{ ...banco, data: "2026-09-17", descricao }]).sugestoes.size).toBe(0);
  }
  expect(sugestoes(linhas, [{ ...banco, data: "2026-09-17", valor: -125.54 }]).sugestoes.size).toBe(0);
});
it("normaliza acentos, caixa e pontuação na contraparte da janela ampliada", () => {
  const dados = linhas.map(l => ({ ...l, notaFiscal: { ...nota, fornecedorNome: "HORTA DA SÉRRA LTDA." } }));
  expect(sugestoes(dados, [{ ...banco, data: "2026-09-17", descricao: "Pix: horta / da serra" }]).sugestoes.size).toBe(1);
});
it("considera sete dias atravessando o mês e ano bissexto", () => {
  const dados = linhas.map(l => ({ ...l, dataVencimento: "2024-02-26T12:00:00Z" }));
  expect(sugestoes(dados, [{ ...banco, data: "2024-03-04" }]).sugestoes.size).toBe(1);
  expect(sugestoes(dados, [{ ...banco, data: "2024-03-05" }]).sugestoes.size).toBe(0);
});
it("mantém revisão manual quando o vencimento ampliado introduz outra candidata", () => {
  const outra = linhas.map(l => ({ ...l, id: l.id + "2", dataVencimento: "2026-09-17T12:00:00Z", notaFiscal: { ...nota, id: "outra" } }));
  const resultado = sugestoes([...linhas, ...outra]);
  expect(resultado.sugestoes.size).toBe(0);
  expect(resultado.ambiguas.has("banco")).toBe(true);
});
it("exclui conciliados, conta divergente, tipo diferente e falta de acesso a baixa", () => {
  expect(sugestoes(linhas.map(l => ({ ...l, transacaoExtratoId: "anterior" }))).sugestoes.size).toBe(0);
  expect(sugestoes(linhas, [{ ...banco, conciliadaEm: "2026-09-11" }]).sugestoes.size).toBe(0);
  expect(sugestoes(linhas.map(l => ({ ...l, contaBancariaId: "outra" }))).sugestoes.size).toBe(0);
  expect(sugestoes(linhas, [{ ...banco, valor: 125.55 }]).sugestoes.size).toBe(0);
  expect(sugestoes(linhas, [banco], false).sugestoes.size).toBe(0);
});
it("realizados exigem mesma data e não dependem da permissão de baixar", () => {
  const pagos = linhas.map(l => ({ ...l, status: "BAIXADO" as const, contaBancariaId: "conta", dataPagamento: "2026-09-10" }));
  expect(sugestoes(pagos, [banco], false).sugestoes.size).toBe(1);
  expect(sugestoes(pagos, [{ ...banco, data: "2026-09-11" }]).sugestoes.size).toBe(0);
});
