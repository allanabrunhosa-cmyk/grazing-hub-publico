import { expect, it } from "vitest";
import { agruparMovimentacoes } from "@/lib/financeiro/agrupar-movimentacoes";
import { montarLinhasExtrato, calcularExtrato } from "@/lib/financeiro/extrato";
import { lancamentoTeste } from "./dados-movimentacoes";

const notaFiscal = { id: "nota-1", numero: "31562", serie: "1", fornecedorNome: "Fornecedor de frios" };
const itens = [lancamentoTeste({ id: "queijo", valor: 100.10, notaFiscal }), lancamentoTeste({ id: "presunto", valor: 50.20, notaFiscal, categoriaNome: "Insumos" })];

it("soma os produtos da mesma NF em centavos e mostra fornecedor e número", () => {
  const [grupo] = agruparMovimentacoes(montarLinhasExtrato(itens, []));
  expect(grupo).toMatchObject({ titulo: "Fornecedor de frios", subtitulo: "NF-e nº 31562 · Série 1", valor: -150.30, categoria: "Categorias diversas" });
  expect(grupo.linhas).toHaveLength(2);
});
it("usa o valor final da parcela na linha principal e mantém os itens na composição", () => {
  const parcela = { id: "parcela-1", numero: "001", valor: 145.75 };
  const [grupo] = agruparMovimentacoes(montarLinhasExtrato(itens.map(item => ({ ...item, notaFiscal: { ...notaFiscal, parcela } })), []));
  expect(grupo).toMatchObject({ valor: -145.75, valorComponentes: -150.30 });
  expect(grupo.linhas).toHaveLength(2);
});
it("não junta outras notas do mesmo fornecedor, dias, situações ou lançamentos manuais", () => {
  const linhas = montarLinhasExtrato([...itens,
    lancamentoTeste({ id: "outra-nota", notaFiscal: { ...notaFiscal, id: "nota-2" } }),
    lancamentoTeste({ id: "outra-data", notaFiscal, dataVencimento: "2026-09-11T12:00:00Z" }),
    lancamentoTeste({ id: "realizada", notaFiscal, status: "BAIXADO", dataPagamento: "2026-09-10T12:00:00Z" }),
    lancamentoTeste({ id: "manual-1", fornecedorNome: notaFiscal.fornecedorNome }),
    lancamentoTeste({ id: "manual-2", fornecedorNome: notaFiscal.fornecedorNome }),
  ], []);
  expect(agruparMovimentacoes(linhas)).toHaveLength(6);
});
it("preserva os saldos originais por conta e não duplica os itens após agrupar", () => {
  const linhas = montarLinhasExtrato(itens.map((l) => ({ ...l, contaBancariaId: "conta" })), []);
  const calcular = () => calcularExtrato(linhas, 0, { de: "2026-09-01", ate: "2026-09-30" }, "TUDO", [{ id: "conta", saldoInicial: 500, dataSaldoInicial: "2026-09-10" }]);
  const anterior = calcular();
  agruparMovimentacoes(linhas);
  expect(calcular()).toEqual(anterior);
  expect(anterior.saldoFinal).toBe(349.70);
  expect(anterior.saidas).toBe(150.30);
});
