// CNPJ exclusivamente fictício, com dígitos verificadores válidos para a fixture.
import { describe, expect, it } from "vitest";
import { criarIdentificadorDps } from "@/lib/nfse/dps";
import { extrairDadosNfse } from "@/lib/nfse/parse";
import { MUNICIPIOS_NFSE } from "@/lib/nfse/municipios";

describe("lista de municípios para DPS", () => {
  it("mantém a lista oficial completa com código IBGE e UF", () => {
    expect(MUNICIPIOS_NFSE.length).toBeGreaterThanOrEqual(5570);
    expect(new Set(MUNICIPIOS_NFSE.map((municipio) => municipio.codigo)).size).toBe(MUNICIPIOS_NFSE.length);
    expect(MUNICIPIOS_NFSE.every((municipio) => /^\d{7}$/.test(municipio.codigo) && /^[A-Z]{2}$/.test(municipio.uf))).toBe(true);
    expect(MUNICIPIOS_NFSE).toContainEqual({ codigo: "3550308", nome: "São Paulo", uf: "SP" });
  });
});

describe("identificador da DPS", () => {
  it("monta o identificador nacional com CPF e preenchimento à esquerda", () => {
    expect(criarIdentificadorDps({ cpfCnpj: "123.456.789-09", serie: "3", numero: "42", municipioCodigo: "3550308" }))
      .toBe("DPS355030810001234567890900003000000000000042");
  });

  it("monta o identificador XML com CNPJ e série numérica", () => {
    expect(criarIdentificadorDps({ cpfCnpj: "11.222.333/0001-81", serie: "1", numero: "100", municipioCodigo: "2927408" }))
      .toBe("DPS292740821122233300018100001000000000000100");
  });

  it.each(["A1", "1.2", "-1", "", "123456"])("recusa a série inválida %s sem alterar a identificação", serie => {
    expect(() => criarIdentificadorDps({ cpfCnpj: "12345678909", serie, numero: "1", municipioCodigo: "3550308" })).toThrow("série");
  });

  it.each(["1A2", "-42", "1.2", "", "1234567890123456"])("recusa o número inválido %s sem descartar caracteres", numero => {
    expect(() => criarIdentificadorDps({ cpfCnpj: "12345678909", serie: "1", numero, municipioCodigo: "3550308" })).toThrow("número");
  });

  it("recusa campos fora do leiaute", () => {
    expect(() => criarIdentificadorDps({ cpfCnpj: "123", serie: "1", numero: "1", municipioCodigo: "3550308" })).toThrow("CPF");
    expect(() => criarIdentificadorDps({ cpfCnpj: "12345678909", serie: "1", numero: "1", municipioCodigo: "35503" })).toThrow("IBGE");
    expect(() => criarIdentificadorDps({ cpfCnpj: "12345678909", serie: "123456", numero: "1", municipioCodigo: "3550308" })).toThrow("série");
  });
});

describe("leitura do vínculo com a DPS", () => {
  it("extrai Id, série, número e município da DPS nacional", () => {
    const id = "DPS355030821122233300018100003000000000000042";
    const xml = `<NFSe><infNFSe Id="NFS35503082000000000000000000000000000000000000000001"><nNFSe>42</nNFSe><dhEmi>2026-09-17T10:00:00-03:00</dhEmi><DPS><infDPS Id="${id}"><cLocEmi>3550308</cLocEmi><serie>3</serie><nDPS>42</nDPS><prest><CNPJ>11222333000181</CNPJ><xNome>Prestador</xNome></prest><toma><CNPJ>11222333000181</CNPJ><xNome>Tomador</xNome></toma></infDPS></DPS><emit><CNPJ>11222333000181</CNPJ><xNome>Prestador</xNome></emit></infNFSe></NFSe>`;
    const dados = extrairDadosNfse(xml, "11222333000181");
    expect(dados.dpsIdentificador).toBe(id);
    expect(dados.dpsSerie).toBe("3");
    expect(dados.dpsNumero).toBe("42");
    expect(dados.dpsMunicipioCodigo).toBe("3550308");
  });
});
