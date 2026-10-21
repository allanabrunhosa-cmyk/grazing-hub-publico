import { describe, expect, it } from "vitest";
import { centavosArquivo, lerArquivoExtrato } from "@/lib/financeiro/conciliacao/arquivo";
import { ofxTeste, mapaCsvTeste } from "./dados";
describe("leitura de OFX e CSV", () => {
  it("lê OFX SGML, preserva identificador, sinal e dia bancário sem deslocar pelo fuso", () => {
    const r = lerArquivoExtrato(ofxTeste(), "banco.ofx");
    expect(r.referenciaOfx).toBe("001 / 0001 / 12345");
    expect(r.linhas).toEqual([{ indice: 0, data: "2026-09-11", centavos: -12555, descricao: "Fornecedor teste · Compra de insumos", identificador: "banco-001" }]);
  });
  it("aceita OFX XML com folhas fechadas", () => {
    const xml = ofxTeste().replace(/<(CURDEF|BANKID|BRANCHID|ACCTID|ACCTTYPE|DTSTART|DTEND|TRNTYPE|DTPOSTED|TRNAMT|FITID|NAME|MEMO)>([^<]*)/g, (_, tag, valor) => `<${tag}>${valor.trim()}</${tag}>`);
    expect(lerArquivoExtrato(xml, "banco.OFX").linhas[0].centavos).toBe(-12555);
  });
  it.each([
    ofxTeste().replace("<FITID>banco-001", ""), ofxTeste().replace("BRL", "USD"), ofxTeste().replace("20260911120000", "20260230120000"),
    ofxTeste().replace("</STMTTRN>", ""), ofxTeste() + "<!ENTITY x SYSTEM 'file:///privado'>", ofxTeste() + "<CORRECTFITID>1", ofxTeste() + ofxTeste(), ofxTeste("0"),
  ])("recusa arquivo incompleto, ambíguo, moeda estrangeira ou instruções externas", texto => expect(() => lerArquivoExtrato(texto, "banco.ofx")).toThrow());
  it("lê CSV com aspas, acentos, milhares e identificadores opcionais", () => {
    const r = lerArquivoExtrato('Data;Histórico;Valor\n11/09/2026;"Pagamento; queijo";"-1.234,56"\n12/09/2026;Recebimento;0,01', "banco.csv", mapaCsvTeste);
    expect(r.linhas.map(l => l.centavos)).toEqual([-123456, 1]); expect(r.linhas[0].descricao).toBe("Pagamento; queijo");
  });
  it("ignora Saldo do dia em CSV e preserva o índice original das transações", () => {
    const r = lerArquivoExtrato('Data;Descrição;Valor\n11/09/2026;  SALDO TOTAL DISPONÍVEL DIA  ;1.000,00\n11/09/2026;PIX;-10,00', "banco.csv", mapaCsvTeste);
    expect(r.linhasSaldoIgnoradas).toBe(1);
    expect(r.linhas).toEqual([{ indice: 1, data: "2026-09-11", descricao: "PIX", centavos: -1000, identificador: null }]);
  });
  it("ignora Saldo do dia em OFX mesmo quando NAME e MEMO compõem a descrição", () => {
    const saldo = '<STMTTRN><TRNTYPE>OTHER<DTPOSTED>20260911120000[-3:BRT]<TRNAMT>1000.00<FITID>saldo-001<NAME>Saldo do dia<MEMO>11/09/2026</STMTTRN>\n';
    const r = lerArquivoExtrato(ofxTeste().replace("<STMTTRN>", saldo + "<STMTTRN>"), "banco.ofx");
    expect(r.linhasSaldoIgnoradas).toBe(1);
    expect(r.linhas[0]).toMatchObject({ indice: 1, descricao: "Fornecedor teste · Compra de insumos" });
  });
  it("explica quando o arquivo contém apenas Saldo do dia", () => {
    expect(() => lerArquivoExtrato('Data;Descrição;Valor\n11/09/2026;Saldo do dia;1.000,00', "banco.csv", mapaCsvTeste)).toThrow(/apenas linhas informativas/);
  });
  it("não confunde outras descrições que apenas mencionam saldo", () => {
    expect(lerArquivoExtrato('Data;Descrição;Valor\n11/09/2026;Transferência para recompor saldo;-10,00', "banco.csv", mapaCsvTeste).linhas).toHaveLength(1);
  });
  it("ignora saldo anterior do Itaú, inclusive com data, sem ignorar pagamentos", () => {
    const csv = 'Data;Descrição;Valor\n11/09/2026;SALDO ANTERIOR;1.000,00\n11/09/2026;Saldo anterior · 10/09/2026;900,00\n11/09/2026;Saldo anterior pago ao fornecedor;-10,00';
    const r = lerArquivoExtrato(csv, "itau.csv", mapaCsvTeste);
    expect(r.linhasSaldoIgnoradas).toBe(2);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].descricao).toBe("Saldo anterior pago ao fornecedor");
  });
  it("aceita cabeçalho em outra linha e colunas separadas de crédito/débito", () => {
    const r = lerArquivoExtrato('Relatório;;;\nData;Descrição;Entrada;Saída\n2026-09-11;Tarifa;;10.00\n2026-09-12;Venda;25.50;', "banco.csv", { ...mapaCsvTeste, cabecalho: 1, formatoData: "ISO", formatoValor: "US", modo: "COLUNAS", entrada: 2, saida: 3 });
    expect(r.linhas.map(l => l.centavos)).toEqual([-1000, 2550]);
  });
  it("preserva linhas idênticas sem identificador, pois podem ser transações diferentes", () => expect(lerArquivoExtrato('Data;Descrição;Valor\n11/09/2026;PIX;-10,00\n11/09/2026;PIX;-10,00', "banco.csv", mapaCsvTeste).linhas).toHaveLength(2));
  it.each(["1.234,567", "R$abc", "NaN", "1,2,3", "1e3", "1.2", "1000000000000,00"]) ("recusa valor brasileiro ambíguo: %s", valor => expect(() => centavosArquivo(valor, "BR")).toThrow());
  it("conserva centavos exatos e interpreta negativos entre parênteses", () => { expect(centavosArquivo("(1.234,56)", "BR")).toBe(-123456); expect(centavosArquivo("0.29", "US")).toBe(29); });
  it("não ignora silenciosamente linhas inválidas nem aceita uma coluna em dois campos", () => {
    const csv = 'Data;Descrição;Valor\n31/02/2026;Tarifa;-10,00';
    expect(() => lerArquivoExtrato(csv, "banco.csv", mapaCsvTeste)).toThrow(/data inválida/);
    expect(() => lerArquivoExtrato(csv, "banco.csv", { ...mapaCsvTeste, valor: 1 })).toThrow(/coluna/);
  });
});
