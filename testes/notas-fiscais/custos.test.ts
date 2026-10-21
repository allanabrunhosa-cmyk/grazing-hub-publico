import { describe, expect, it } from "vitest";
import { calcularCustosNota, lerComposicaoCusto, ratearValor, ratearDesconto, totalCustoItem } from "@/lib/notas-fiscais/custos";
import { extrairCustosNFe } from "@/lib/sefaz/custosNFe";
import { validarCustosConciliacao } from "@/lib/notas-fiscais/validar-custos";

import { xmlCmc, xmlCustos } from "./custos-dados";

const custos = extrairCustosNFe(xmlCustos);
describe("custos da nota e desconto por produto", () => {
  it("incorpora o IPI e o frete exatos de cada produto, sem ratear o imposto novamente", () => {
    expect(custos).toMatchObject({ produtos: 400, frete: 40, ipi: 20, desconto: 20, totalNota: 445 });
    expect(custos.itens.map(item => [item.ipi, item.frete, totalCustoItem(item)])).toEqual([[8, 10, 113], [12, 30, 332]]);
    expect(calcularCustosNota(custos, { modo: "NOTA", itens: [] })).toMatchObject({ total: 445 });
  });
  it("calcula desconto proporcional pelo valor bruto dos produtos", () => {
    expect(calcularCustosNota(custos, { modo: "PROPORCIONAL", itens: [] })).toMatchObject({ itens: [{ desconto: 5, total: 113 }, { desconto: 15, total: 332 }], total: 445 });
  });
  it("redistribui desconto personalizado mantendo o total da nota", () => {
    expect(calcularCustosNota(custos, { modo: "PERSONALIZADO", itens: [{ numeroItem: 1, desconto: 20 }, { numeroItem: 2, desconto: 0 }] })).toMatchObject({ itens: [{ total: 98 }, { total: 347 }], total: 445 });
  });
  it("fecha centavos mesmo com vários produtos e pesos muito diferentes", () => {
    const iguais = Array.from({ length: 6 }, (_, i) => ({ ...custos.itens[0], numeroItem: i + 1, produtos: 1 }));
    expect(ratearDesconto(0.04, iguais)).toEqual([0.01, 0.01, 0.01, 0.01, 0, 0]);
    expect(ratearDesconto(400, custos.itens)).toEqual([100, 300]);
    expect(ratearValor(0.04, [1, 1, 1, 1, 1, 1])).toEqual([0.01, 0.01, 0.01, 0.01, 0, 0]);
  });
  it.each([
    [{ numeroItem: 1, desconto: 1 }, { numeroItem: 2, desconto: 1 }],
    [{ numeroItem: 1, desconto: -1 }, { numeroItem: 2, desconto: 21 }],
    [{ numeroItem: 1, desconto: 20 }, { numeroItem: 1, desconto: 0 }],
    [{ numeroItem: 1, desconto: NaN }, { numeroItem: 2, desconto: 0 }],
    [{ numeroItem: 1, desconto: 5.001 }, { numeroItem: 2, desconto: 14.999 }],
  ])("rejeita distribuição incompleta, negativa, repetida ou sem precisão monetária", (...itens) => {
    expect(calcularCustosNota(custos, { modo: "PERSONALIZADO", itens })).toHaveProperty("erro");
  });
  it("não deixa um item negativo, nem lança IPI isento", () => {
    expect(calcularCustosNota({ ...custos, desconto: 150 }, { modo: "PERSONALIZADO", itens: [{ numeroItem: 1, desconto: 150 }, { numeroItem: 2, desconto: 0 }] })).toHaveProperty("erro");
    const isento = extrairCustosNFe(xmlCustos.replace('<IPITrib><vIPI>8.00</vIPI></IPITrib>', '<IPINT><CST>02</CST></IPINT>'));
    expect(isento.itens[0].ipi).toBe(0);
  });
  it("mantém o ICMS próprio da CMC dentro do produto e não deduz desoneração sem indicação", () => {
    const custosCmc = extrairCustosNFe(xmlCmc);
    expect(custosCmc).toMatchObject({ produtos: 4021.77, abatimentos: 0, totalNota: 4021.77, tributos: { icmsIncluso: 281.51 } });
    expect(custosCmc.itens[0]).toMatchObject({ produtos: 4021.77, abatimentos: 0, tributos: { icmsIncluso: 281.51 } });
    expect(calcularCustosNota(custosCmc, { modo: "NOTA", itens: [] })).toMatchObject({ total: 4021.77, itens: [{ total: 4021.77 }] });
  });
  it("deduz ICMS desonerado somente quando o XML traz indDeduzDeson igual a 1", () => {
    const xmlComDeducao = xmlCmc
      .replace("</ICMS20>", "<indDeduzDeson>1</indDeduzDeson></ICMS20>")
      .replace("<vNF>4021.77</vNF>", "<vNF>3793.24</vNF>");
    const comDeducao = extrairCustosNFe(xmlComDeducao);
    expect(comDeducao).toMatchObject({ abatimentos: 228.53, totalNota: 3793.24 });
    expect(calcularCustosNota(comDeducao, { modo: "NOTA", itens: [] })).toMatchObject({ total: 3793.24 });
  });
  it("soma todos os tributos destacados que compõem o total da NF-e", () => {
    const xml = `<nfeProc><NFe><infNFe><det nItem="1"><prod><vProd>100</vProd></prod><imposto><ICMS><ICMS61><vICMSST>10</vICMSST><vFCPST>2</vFCPST><vICMSMonoReten>3</vICMSMonoReten></ICMS61></ICMS><IPI><IPITrib><vIPI>7</vIPI></IPITrib></IPI><II><vII>6</vII></II><PISST><vPIS>4</vPIS><indSomaPISST>1</indSomaPISST></PISST><COFINSST><vCOFINS>5</vCOFINS><indSomaCOFINSST>1</indSomaCOFINSST></COFINSST></imposto><impostoDevol><IPI><vIPIDevol>8</vIPIDevol></IPI></impostoDevol></det><total><ICMSTot><vProd>100</vProd><vST>10</vST><vFCPST>2</vFCPST><vICMSMonoReten>3</vICMSMonoReten><vII>6</vII><vIPI>7</vIPI><vIPIDevol>8</vIPIDevol><vNF>145</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
    const completos = extrairCustosNFe(xml);
    expect(completos.itens[0]).toMatchObject({ ipi: 7, outrosTributos: 38, tributos: { icmsSt: 10, fcpSt: 2, icmsMonofasicoRetido: 3, impostoImportacao: 6, pisSt: 4, cofinsSt: 5, ipiDevolvido: 8 } });
    expect(calcularCustosNota(completos, { modo: "NOTA", itens: [] })).toMatchObject({ total: 145 });
  });
  it("mantém compatibilidade com composições gravadas antes do detalhamento dos impostos", () => {
    const anterior = { numeroItem: 1, produtos: 100, frete: 0, ipi: 0, seguro: 0, outrasDespesas: 0, outrosTributos: 10, abatimentos: 0, desconto: 0, modoDesconto: "NOTA", total: 110 };
    expect(lerComposicaoCusto(anterior)).toMatchObject({ total: 110, outrosTributos: 10, tributos: { icmsIncluso: 0, icmsSt: 0, pisSt: 0 } });
  });
  it("confere o custo e impede reaplicar desconto em item já conciliado", () => {
    const registros = [{ id: "a", numeroItem: 1, status: "PENDENTE" }, { id: "b", numeroItem: 2, status: "PENDENTE" }];
    const entrada = [{ notaFiscalItemId: "a", acao: "CONCILIAR", valorTotal: 113 }, { notaFiscalItemId: "b", acao: "CONCILIAR", valorTotal: 332 }];
    expect(validarCustosConciliacao(xmlCustos, registros, entrada)).toHaveProperty("erro");
    expect(validarCustosConciliacao(xmlCustos, registros, entrada, { modo: "NOTA", itens: [] })).toHaveProperty("composicoes");
    expect(validarCustosConciliacao(xmlCustos, registros, [{ ...entrada[0], valorTotal: 100 }, entrada[1]], { modo: "NOTA", itens: [] })).toHaveProperty("erro");
    expect(validarCustosConciliacao(xmlCustos, [{ ...registros[0], status: "CONCILIADO" }, registros[1]], entrada, { modo: "PERSONALIZADO", itens: [{ numeroItem: 1, desconto: 20 }, { numeroItem: 2, desconto: 0 }] })).toHaveProperty("erro");
  });
});
