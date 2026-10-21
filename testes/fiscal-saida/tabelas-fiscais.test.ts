import { describe, expect, it } from "vitest";
import { consultarTabelaFiscal } from "@/lib/fiscal/catalogos/consulta";
import { TABELAS_FISCAIS } from "@/lib/fiscal/catalogos/tipos";
import { classificacoesRegraBrasilNfe, hashRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { validarFiscal } from "@/lib/vendas/dominio";
import { herdarParametrosFiscais } from "@/lib/tributacao/heranca";

const dia = "2026-10-14";
describe("Catálogos fiscais oficiais, sem decisão tributária implícita", () => {
  it("contém NCM completo e pesquisa código e descrição sem depender de CRT", () => {
    const nacional = consultarTabelaFiscal({ tabela: "ncm", dia, crt: 1 });
    expect(nacional.total).toBeGreaterThan(10000); expect(nacional.opcoes).toHaveLength(50);
    const codigo = consultarTabelaFiscal({ tabela: "ncm", dia, busca: "19059090", crt: 3 });
    expect(codigo.opcoes).toHaveLength(1); expect(codigo.opcoes[0].descricao).toMatch(/padaria/i);
    expect(consultarTabelaFiscal({ tabela: "ncm", dia, busca: "cafe" }).opcoes.length).toBeGreaterThan(6);
    expect(consultarTabelaFiscal({ tabela: "ncm", dia, crt: 3 }).total).toBe(nacional.total);
  });
  it.each(TABELAS_FISCAIS)("%s tem fonte oficial, versão e hash reais", tabela => {
    const r = consultarTabelaFiscal({ tabela, dia, operacao: "TODAS" });
    expect(r.versao).not.toBe(""); expect(r.fonte).toMatch(/^https:\/\/(?:www\.)?(?:nfe\.fazenda\.gov\.br|portalunico\.siscomex\.gov\.br|confaz\.fazenda\.gov\.br|portal\.fazenda\.sp\.gov\.br)/);
    expect(r.sha256Origem).toMatch(/^[0-9a-f]{64}$/); expect(r.total).toBeGreaterThan(0);
    expect(r.opcoes.every(o => !/[<>\u0000-\u001f]/.test(o.descricao))).toBe(true);
  });
  it("filtra CFOP pela operação e conserva código antigo fora do contexto", () => {
    const r = consultarTabelaFiscal({ tabela: "cfop", dia, operacao: "INTERNA", selecionado: "6101" });
    expect(r.opcoes.every(o => o.codigo.startsWith("5"))).toBe(true);
    expect(r.selecionado).toMatchObject({ codigo: "6101", vigente: false });
    expect(consultarTabelaFiscal({ tabela: "cfop", dia, operacao: "INTERESTADUAL" }).opcoes.every(o => o.codigo.startsWith("6"))).toBe(true);
    expect(consultarTabelaFiscal({ tabela: "cfop", dia, modelo: 65 }).opcoes.every(o => o.codigo.startsWith("5"))).toBe(true);
  });
  it("filtra CSOSN/CST pelo CRT sem inventar a tributação", () => {
    expect(consultarTabelaFiscal({ tabela: "csosn", dia, crt: 1 }).total).toBe(10);
    expect(consultarTabelaFiscal({ tabela: "csosn", dia, crt: 2 }).total).toBe(0);
    expect(consultarTabelaFiscal({ tabela: "cstIcms", dia, crt: 1 }).opcoes.map(o => o.codigo)).toEqual(["02", "15", "53", "61"]);
    expect(consultarTabelaFiscal({ tabela: "cstIcms", dia, crt: 3 }).total).toBe(15);
    expect(consultarTabelaFiscal({ tabela: "cstIcms", dia, crt: 3, uf: "SP", busca: "51" }).opcoes).toEqual([]);
  });
  it("CEST considera NCM e a vigência futura sem determinar ST", () => {
    const r = consultarTabelaFiscal({ tabela: "cest", dia, ncm: "85166000", busca: "2104600" });
    expect(r.opcoes).toHaveLength(1); expect(r.opcoes[0].descricao).toContain("incluídas");
    const futuro = consultarTabelaFiscal({ tabela: "cest", dia: "2026-11-01", ncm: "85166000", busca: "2104600" });
    expect(futuro.opcoes).toHaveLength(1); expect(futuro.opcoes[0].descricao).toContain("incluindo");
    expect(r.aviso).toMatch(/não determina.*ST/);
    expect(consultarTabelaFiscal({ tabela: "cest", dia, ncm: "01012100" }).opcoes).toEqual([]);
  });
  it("não oferece crédito de entrada para PIS/COFINS de saída", () => {
    for (const tabela of ["pis", "cofins"] as const) {
      const codigos = consultarTabelaFiscal({ tabela, dia }).opcoes.map(o => o.codigo);
      expect(codigos).toContain("49"); expect(codigos).toContain("99"); expect(codigos).not.toContain("50"); expect(codigos).not.toContain("70");
      expect(consultarTabelaFiscal({ tabela, dia, operacao: "TODAS" }).total).toBeGreaterThan(30);
    }
  });
  it("filtra enquadramento IPI por CST e IBS/CBS por modelo e CST", () => {
    const isencao = consultarTabelaFiscal({ tabela: "cEnq", dia, ipi: "52" });
    expect(isencao.opcoes.every(o => o.codigo.startsWith("3"))).toBe(true);
    const ibs = consultarTabelaFiscal({ tabela: "cClassTrib", dia, modelo: 65, cst: "000" });
    expect(ibs.opcoes.length).toBeGreaterThan(0); expect(ibs.opcoes.every(o => o.codigo.startsWith("000"))).toBe(true);
    expect(consultarTabelaFiscal({ tabela: "cBenef", dia, uf: "RJ" }).total).toBe(0);
    expect(consultarTabelaFiscal({ tabela: "cBenef", dia, uf: "SP", busca: "SEM CBENEF" }).opcoes).toEqual([]);
  });
  it("preserva seleção inexistente e explicita limite do histórico NCM", () => {
    expect(consultarTabelaFiscal({ tabela: "ncm", dia, selecionado: "99999999" }).selecionado).toMatchObject({ codigo: "99999999", vigente: false });
    expect(consultarTabelaFiscal({ tabela: "ncm", dia: "2020-01-01" }).aviso).toMatch(/histórico Classif/);
    expect(() => consultarTabelaFiscal({ tabela: "ncm", busca: "x".repeat(101) })).toThrow();
    expect(() => consultarTabelaFiscal({ tabela: "ncm", dia: "2026-02-30" })).toThrow();
  });
  it("campos opcionais não alteram hashes históricos nem aceitam segredos", () => {
    const legado = classificacoesRegraBrasilNfe({ ncm: "19059090", origem: "0", cfop: "5101", pis: "49", cofins: "49", csosn: "102" });
    expect(classificacoesRegraBrasilNfe({ ...legado, cBenef: "", cClassTrib: "" })).toEqual(legado);
    expect(hashRegraFiscalBrasilNfe(classificacoesRegraBrasilNfe(legado))).toBe(hashRegraFiscalBrasilNfe(legado));
    expect(classificacoesRegraBrasilNfe({ ...legado, cEnq: "999" }).cEnq).toBe("999");
    expect(() => classificacoesRegraBrasilNfe({ ...legado, cBenef: "Token=segredo" })).toThrow();
    expect(() => validarFiscal({ cstIbsCbs: "abc" }, false)).toThrow();
    expect(validarFiscal({ cstIbsCbs: "000", cClassTrib: "000001" }, false)).toMatchObject({ cstIbsCbs: "000", cClassTrib: "000001" });
  });
  it("grupo não copia classificação, origem, unidade ou GTIN e conserva exceções", () => {
    const r = herdarParametrosFiscais({ ncm: "04069020", ean: "SEM GTIN", origem: "0", cfop: "5102", pis: "01" }, { ncm: "19059090", cfop: "5101", pis: "49" });
    expect(r).toEqual({ ncm: "19059090", cfop: "5101", pis: "49" });
    expect(herdarParametrosFiscais({ ncm: "04069020", ean: "SEM GTIN", cfop: "5102" }, {})).toEqual({ cfop: "5102" });
  });
});
