import { describe, expect, it } from "vitest";
import { correspondeBuscaMovimentacao } from "@/lib/financeiro/busca-movimentacoes";
import { agruparMovimentacoes } from "@/lib/financeiro/agrupar-movimentacoes";
import { montarLinhasExtrato } from "@/lib/financeiro/extrato";
import { lancamentoTeste } from "./dados-movimentacoes";

const grupo = agruparMovimentacoes(montarLinhasExtrato([lancamentoTeste({ valor: 1234.56 })], []))[0];

describe("Busca de movimentações somente após o agrupamento", () => {
  it.each(["1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "-1.234,56", "  R$ 1.234,56  "])("encontra o valor exato em %s", busca => {
    expect(correspondeBuscaMovimentacao(grupo, busca)).toBe(true);
  });
  it.each(["1.234,57", "1234,567", "1234.567", "R$ NaN", "+1234,56"])("não inventa valor nem ignora sinal explícito em %s", busca => {
    expect(correspondeBuscaMovimentacao(grupo, busca)).toBe(false);
  });
  it.each(["50", "50,00", "50.00"])("aceita valor inteiro e centavos em %s", busca => {
    const pequeno = { ...grupo, valor: -50, linhas: [] };
    expect(correspondeBuscaMovimentacao(pequeno, busca)).toBe(true);
  });
  it("busca texto sem acentos, categoria e contraparte", () => {
    for (const busca of ["aluguel", "cozinha", "ocupacao", "LOCADOR", "", "   "]) expect(correspondeBuscaMovimentacao(grupo, busca)).toBe(true);
  });
  it("preserva a parcela líquida e os itens quando o termo corresponde a um componente", () => {
    const notaFiscal = { id: "nf-ficticia", numero: "31562", serie: "1", fornecedorNome: "Fornecedor fictício", parcela: { id: "parcela-ficticia", numero: "1", valor: 76 } };
    const nota = agruparMovimentacoes(montarLinhasExtrato([
      lancamentoTeste({ id: "queijo", descricao: "Queijo", valor: 70, notaFiscal }),
      lancamentoTeste({ id: "frio", descricao: "Frios", valor: 30, notaFiscal }),
    ], []))[0];
    const antes = structuredClone(nota);
    for (const busca of ["Queijo", "Frios", "31562", "76,00", "70,00", "30,00"]) expect(correspondeBuscaMovimentacao(nota, busca)).toBe(true);
    expect(correspondeBuscaMovimentacao(nota, "100,00")).toBe(false);
    expect(nota).toEqual(antes);
    expect(nota.valor).toBe(-76); expect(nota.linhas).toHaveLength(2);
  });
  it("procura também uma movimentação avulsa e sua conta", () => {
    const avulsa = agruparMovimentacoes(montarLinhasExtrato([], [{ id: "avulsa-ficticia", tipo: "ENTRADA", valor: 60, data: "2026-09-10", descricao: "Depósito avulso", contaBancariaNome: "Conta fictícia", contaBancariaId: "banco" }]))[0];
    expect(correspondeBuscaMovimentacao(avulsa, "deposito")).toBe(true);
    expect(correspondeBuscaMovimentacao(avulsa, "Conta ficticia")).toBe(true);
    expect(correspondeBuscaMovimentacao(avulsa, "+60,00")).toBe(true);
    expect(correspondeBuscaMovimentacao(avulsa, "-60,00")).toBe(false);
  });
});
