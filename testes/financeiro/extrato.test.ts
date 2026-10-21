import { describe, expect, it } from "vitest";
import { calcularExtrato, montarLinhasExtrato, dataValida } from "@/lib/financeiro/extrato";
import { lancamentoTeste } from "./dados-movimentacoes";

const periodo = { de: "2026-09-01", ate: "2026-09-30" };
describe("extrato de movimentações", () => {
  it("pedido misto reconhece somente dinheiro no extrato e no saldo anterior, sem excluir a venda da origem", () => {
    const credito = lancamentoTeste({ id: "credito", tipo: "RECEITA", valor: 250, status: "BAIXADO", pedidoVendaId: "pedido", pedidoQuitadoCredito: true, dataPagamento: "2026-08-31T12:00:00Z" });
    const recebido = lancamentoTeste({ id: "recebido", tipo: "RECEITA", valor: 350, status: "BAIXADO", pedidoVendaId: "pedido", dataPagamento: "2026-09-10T12:00:00Z" });
    const titulos = [credito, recebido];
    const linhas = montarLinhasExtrato(titulos, []);
    expect(linhas.map(l => l.id)).toEqual(["recebido"]);
    expect(calcularExtrato(linhas, 0, periodo, "TUDO")).toMatchObject({ saldoAnterior: 0, entradas: 350, saldoFinal: 350 });
    expect(calcularExtrato(montarLinhasExtrato([{ ...credito, dataPagamento: recebido.dataPagamento }, recebido], []), 0, periodo, "BAIXADO")).toMatchObject({ entradas: 350, saldoFinal: 350 });
    expect(titulos.map(t => t.valor)).toEqual([250, 350]);
  });
  it("usa pagamento após a baixa e mantém o vencimento original nos detalhes", () => {
    const pendente = lancamentoTeste();
    expect(montarLinhasExtrato([pendente], [])[0].data).toBe("2026-09-10");
    const realizada = montarLinhasExtrato([{ ...pendente, status: "BAIXADO", dataPagamento: "2026-09-12T12:00:00Z" }], []);
    expect(realizada[0].data).toBe("2026-09-12");
    expect(realizada[0].lancamento?.dataVencimento).toBe(pendente.dataVencimento);
    expect(calcularExtrato(realizada, 1000, { de: "2026-09-10", ate: "2026-09-10" }, "TUDO").dias).toEqual([{ data: "2026-09-10", linhas: [], saldo: 1000, temSaldoInicial: false }]);
  });
  it("carrega saldo anterior, soma ajustes com sinal, exclui cancelados e filtra situação", () => {
    const linhas = montarLinhasExtrato([
      lancamentoTeste({ id: "anterior", tipo: "RECEITA", valor: 200, status: "BAIXADO", dataPagamento: "2026-08-31T12:00:00Z" }),
      lancamentoTeste({ id: "pendente-anterior", valor: 50, dataVencimento: "2026-08-31T12:00:00Z" }),
      lancamentoTeste(),
      lancamentoTeste({ id: "vendas", tipo: "RECEITA", valor: 500, status: "BAIXADO", dataPagamento: "2026-09-10T12:00:00Z" }),
      lancamentoTeste({ id: "cancelado", status: "CANCELADO", valor: 99999 }),
      lancamentoTeste({ id: "fora", dataVencimento: "2026-10-01T12:00:00Z" }),
    ], [{ id: "ajuste", tipo: "AJUSTE", valor: -25, data: "2026-09-30T23:59:59Z", descricao: "Ajuste", contaBancariaNome: "Banco" }]);
    const tudo = calcularExtrato(linhas, 1000, periodo, "TUDO");
    expect(tudo.saldoAnterior).toBe(1150);
    expect(tudo.dias).toHaveLength(30);
    expect(tudo.dias.map((d) => d.saldo)).toEqual([...Array(9).fill(1150), ...Array(20).fill(850), 825]);
    expect(tudo.entradas).toBe(500);
    expect(tudo.saidas).toBe(825);
    expect(calcularExtrato(linhas, 1000, periodo, "BAIXADO").saldoFinal).toBe(1675);
    expect(calcularExtrato(linhas, 1000, periodo, "PENDENTE").saldoFinal).toBe(150);
  });
  it("preserva centavos e saldo nos períodos vazios", () => {
    const linhas = montarLinhasExtrato([lancamentoTeste({ valor: 0.1 }), lancamentoTeste({ id: "outro", valor: 0.2 })], []);
    expect(calcularExtrato(linhas, 1, periodo, "TUDO").saldoFinal).toBe(0.7);
    const vazio = calcularExtrato([], 123, periodo, "TUDO");
    expect(vazio).toMatchObject({ saldoAnterior: 123, saldoFinal: 123, entradas: 0, saidas: 0 });
    expect(vazio.dias).toHaveLength(30);
    expect(vazio.dias.every((dia) => dia.linhas.length === 0 && dia.saldo === 123)).toBe(true);
  });
  it("mantém dias ocultados pela situação e transporta o saldo entre eles", () => {
    const linhas = montarLinhasExtrato([
      lancamentoTeste({ valor: 100 }),
      lancamentoTeste({ id: "realizado", valor: 25, status: "BAIXADO", dataPagamento: "2026-09-12" }),
    ], []);
    const dias = calcularExtrato(linhas, 500, { de: "2026-09-09", ate: "2026-09-13" }, "BAIXADO").dias;
    expect(dias.map((dia) => [dia.data, dia.linhas.length, dia.saldo])).toEqual([
      ["2026-09-09", 0, 500], ["2026-09-10", 0, 500], ["2026-09-11", 0, 500],
      ["2026-09-12", 1, 475], ["2026-09-13", 0, 475],
    ]);
  });
  it.each([
    ["2024-02-28", "2024-03-01", ["2024-02-28", "2024-02-29", "2024-03-01"]],
    ["2026-12-31", "2027-01-02", ["2026-12-31", "2027-01-01", "2027-01-02"]],
    ["2018-11-03", "2018-11-05", ["2018-11-03", "2018-11-04", "2018-11-05"]],
  ])("inclui os limites e cada dia entre %s e %s", (de, ate, datas) => {
    expect(calcularExtrato([], 0, { de, ate }, "TUDO").dias.map((dia) => dia.data)).toEqual(datas);
  });
  it("mostra todos os 366 dias ao filtrar um ano bissexto inteiro", () => {
    const dias = calcularExtrato([], 100, { de: "2024-01-01", ate: "2024-12-31" }, "TUDO").dias;
    expect(dias).toHaveLength(366);
    expect(new Set(dias.map((dia) => dia.data)).size).toBe(366);
    expect(dias[0].data).toBe("2024-01-01");
    expect(dias.at(-1)).toMatchObject({ data: "2024-12-31", saldo: 100 });
  });
  it.each([
    { de: "", ate: "2026-09-10" }, { de: "2026-02-30", ate: "2026-03-01" },
    { de: "2026-09-10", ate: "2026-09-09" }, { de: "2026-09-01", ate: "inválida" },
  ])("não enumera períodos inválidos: %j", (invalido) => {
    expect(calcularExtrato([], 0, invalido, "TUDO").dias).toEqual([]);
  });
  it.each(["", "2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "abc"])("rejeita data inválida %s", (data) => expect(dataValida(data)).toBe(false));
  it("aceita ano bissexto", () => expect(dataValida("2024-02-29")).toBe(true));
});


it("resume intervalos extensos sem criar milhares de dias vazios e conserva todos os saldos", () => {
  const linhas = montarLinhasExtrato([
    lancamentoTeste({ id: "antiga", valor: 25, dataVencimento: "2006-01-02" }),
    lancamentoTeste({ id: "recente", tipo: "RECEITA", valor: 100, dataVencimento: "2026-10-05" }),
  ], []);
  const resultado = calcularExtrato(linhas, 0, { de: "2006-01-01", ate: "2026-10-05" }, "TUDO", [{ id: "banco", saldoInicial: 500, dataSaldoInicial: "2006-01-01" }]);
  expect(resultado.dias.map(d => d.data)).toEqual(["2006-01-01", "2006-01-02", "2026-10-05"]);
  expect(resultado).toMatchObject({ periodoResumido: true, saldoAnterior: 0, entradas: 100, saidas: 25, saldoFinal: 575 });
  expect(resultado.dias.map(d => d.saldo)).toEqual([500, 475, 575]);
});


it("datas extremas válidas geram somente os limites, sem enumerar milênios", () => {
  const resultado = calcularExtrato([], 123.45, { de: "0001-01-01", ate: "9999-12-31" }, "TUDO");
  expect(resultado.dias.map(d => d.data)).toEqual(["0001-01-01", "9999-12-31"]);
  expect(resultado).toMatchObject({ periodoResumido: true, saldoAnterior: 123.45, saldoFinal: 123.45, entradas: 0, saidas: 0 });
});
