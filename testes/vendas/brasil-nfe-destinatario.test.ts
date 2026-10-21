import { describe, expect, it, vi } from "vitest";
import { resolverDestinatarioBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-destinatario";
vi.mock("@/lib/nfse/municipios", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/nfse/municipios")>();
  return { ...original, MUNICIPIOS_NFSE: [...original.MUNICIPIOS_NFSE,
    { codigo: "3509502", nome: "Cidade sintética ambígua", uf: "SP" },
    { codigo: "3550308", nome: "Cidade sintética ambígua", uf: "SP" },
  ] };
});
const cobranca = { pais: "Brasil", cep: "01001-000", logradouro: "Rua sintética", numero: "1", bairro: "Centro fictício", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" };
const comprador = { tipo: "PF", nome: "Pessoa sintética", documento: "111.111.112-66", inscricaoEstadual: null };
const entrada = { modelo: 55 as const, indicadorPresenca: 2, consumidorFinal: true, comprador, cobranca };
describe("destinatário fiscal sem preenchimento presumido de dados ausentes", () => {
  it("monta endereço/indicador oficiais e conserva os snapshots de origem", () => {
    const foto = structuredClone(entrada); const r = resolverDestinatarioBrasilNfe(entrada);
    expect(r).toMatchObject({ pendencias: [], cliente: { CpfCnpj: "11111111266", NmCliente: "Pessoa sintética", IndicadorIe: 9, Endereco: { Cep: "01001000", Logradouro: "Rua sintética", CodMunicipio: "3550308", Municipio: "São Paulo", Uf: "SP", CodPais: 1058, Pais: "BRASIL" } } }); expect(entrada).toEqual(foto); expect(r.cliente).not.toHaveProperty("Ie");
  });
  it("PJ usa razão social e contribuinte usa IE numérica", () => {
    const r = resolverDestinatarioBrasilNfe({ ...entrada, consumidorFinal: false, comprador: { tipo: "PJ", nome: "Contato fictício", razaoSocial: "Empresa sintética LTDA", documento: "12.345.678/0001-95", inscricaoEstadual: "123.456.789.012" } });
    expect(r).toMatchObject({ pendencias: [], cliente: { NmCliente: "Empresa sintética LTDA", CpfCnpj: "12345678000195", IndicadorIe: 1, Ie: "123456789012" } });
  });
  it.each([undefined, null, "", "   "])("resolve IBGE ausente/vazio %s somente pela cidade e UF fotografadas na tabela oficial", codigoMunicipio => {
    const dados = { ...entrada, cobranca: { ...cobranca, cidade: "  SAO   PAULO  ", uf: " sp ", codigoMunicipio } };
    const foto = structuredClone(dados);
    const r = resolverDestinatarioBrasilNfe(dados);
    expect(r.pendencias).toEqual([]);
    expect(r.cliente?.Endereco).toMatchObject({ CodMunicipio: "3550308", Municipio: "SAO   PAULO", Uf: "SP" });
    expect(dados).toEqual(foto);
  });
  it("não substitui código explícito inválido, de outra UF, divergente da cidade ou com tipo incompatível", () => {
    for (const codigoMunicipio of ["3304557", "3509502", "355030", 3550308, false, { codigo: "3550308" }]) {
      const e = { ...cobranca, codigoMunicipio };
      const foto = structuredClone(e);
      const r = resolverDestinatarioBrasilNfe({ ...entrada, cobranca: e }); expect(r.cliente).toBeUndefined(); expect(r.pendencias.join(" ")).toContain("IBGE");
      expect(e).toEqual(foto);
    }
  });
  it("aceita o alias IBGE textual, mas não ignora aliases explícitos incompatíveis ou divergentes", () => {
    expect(resolverDestinatarioBrasilNfe({ ...entrada, cobranca: { ...cobranca, codigoMunicipio: " ", codigoIbge: "3550308" } }).cliente?.Endereco?.CodMunicipio).toBe("3550308");
    for (const e of [
      { ...cobranca, codigoMunicipio: " ", codigoIbge: 3550308 },
      { ...cobranca, codigoIbge: "3509502" },
    ]) {
      const r = resolverDestinatarioBrasilNfe({ ...entrada, cobranca: e });
      expect(r.cliente).toBeUndefined(); expect(r.pendencias.join(" ")).toContain("IBGE");
    }
  });
  it("NFC-e com entrega reutiliza a mesma resolução oficial, sem preencher o snapshot", () => {
    const dados = { ...entrada, modelo: 65 as const, indicadorPresenca: 4, cobranca: { ...cobranca, codigoMunicipio: undefined } };
    const foto = structuredClone(dados);
    expect(resolverDestinatarioBrasilNfe(dados).cliente?.Endereco?.CodMunicipio).toBe("3550308");
    expect(dados).toEqual(foto);
  });
  it("mantém o bloqueio sem correspondência exata e unívoca de cidade/UF; não usa CEP para inferir", () => {
    for (const e of [
      { ...cobranca, cidade: "", codigoMunicipio: undefined },
      { ...cobranca, uf: "", codigoMunicipio: undefined },
      { ...cobranca, cidade: "São Paul", codigoMunicipio: undefined },
      { ...cobranca, cidade: "São Paulo", uf: "RJ", codigoMunicipio: undefined },
      { ...cobranca, cidade: "Cidade sintética ambígua", codigoMunicipio: undefined },
    ]) {
      const r = resolverDestinatarioBrasilNfe({ ...entrada, cobranca: e });
      expect(r.cliente).toBeUndefined(); expect(r.pendencias.join(" ")).toContain("IBGE");
    }
  });
  it("a resolução do município não supre CEP obrigatório ausente", () => {
    const r = resolverDestinatarioBrasilNfe({ ...entrada, cobranca: { ...cobranca, codigoMunicipio: undefined, cep: "" } });
    expect(r.cliente).toBeUndefined(); expect(r.pendencias.join(" ")).toContain("CEP");
  });
  it("NFC-e presencial não cria cliente para consumidor não identificado, entrega exige identificação/endereço", () => {
    expect(resolverDestinatarioBrasilNfe({ ...entrada, modelo: 65, indicadorPresenca: 1, comprador: {} })).toEqual({ pendencias: [] });
    const r = resolverDestinatarioBrasilNfe({ ...entrada, modelo: 65, indicadorPresenca: 4, comprador: {}, cobranca: {} }); expect(r.cliente).toBeUndefined(); expect(r.pendencias.join(" ")).toMatch(/CPF\/CNPJ/); expect(r.pendencias.join(" ")).toContain("IBGE");
  });
  it("isento é explícito e não envia IE; consumidor contribuinte sem IE não é presumido", () => {
    const r = resolverDestinatarioBrasilNfe({ ...entrada, comprador: { ...comprador, indicadorIe: 2, inscricaoEstadual: "ISENTO" } }); expect(r.cliente?.IndicadorIe).toBe(2); expect(r.cliente).not.toHaveProperty("Ie");
    expect(resolverDestinatarioBrasilNfe({ ...entrada, consumidorFinal: false }).pendencias.join(" ")).toContain("confirmar indicador IE");
    expect(resolverDestinatarioBrasilNfe({ ...entrada, comprador: { ...comprador, indicadorIe: 1 } }).cliente).toBeUndefined();
  });
  it("não remove letras para tornar CPF/CNPJ válido ou usa nome de contato como razão social", () => {
    expect(resolverDestinatarioBrasilNfe({ ...entrada, comprador: { ...comprador, documento: "CPF11111111266" } }).cliente).toBeUndefined();
    const r = resolverDestinatarioBrasilNfe({ ...entrada, comprador: { ...comprador, tipo: "PJ", documento: "12345678000195" } }); expect(r.cliente).toBeUndefined(); expect(r.pendencias.join(" ")).toContain("razão social");
  });
});
