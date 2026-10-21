import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { prepararMapeamentoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/mapeamento";
import { identidadeFicticia, snapshotFicticio } from "./brasilnfe-fixtures";
const contexto = { documentoId: identidadeFicticia.documentoId, emitenteCnpj: identidadeFicticia.emitenteCnpj, ambiente: "HOMOLOGACAO" as const, modelo: 55 as const, crt: 1 as const };
describe("Plano fiscal Brasil NFe sem efeitos comerciais", () => {
  it.each([55, 65] as const)("mapeia modelo %s, identidade do documento e precisão sem autorizar envio", modelo => {
    const payload = snapshotFicticio(), anterior = JSON.stringify(payload);
    const plano = prepararMapeamentoBrasilNfe(payload, { ...contexto, modelo });
    expect(plano.transmissaoPermitida).toBe(false);
    expect(plano.notaParcial).toMatchObject({ IdentificadorInterno: identidadeFicticia.documentoId, ModeloDocumento: modelo, TipoAmbiente: 2, EnviarEmail: false });
    expect(plano.notaParcial.Produtos[0]).toMatchObject({ Quantidade: "1.000001", ValorUnitario: "250.25", NCM: "00000000", CFOP: 5102, Imposto: { ICMS: { CodSituacaoTributaria: "102" } } });
    expect(plano.pendencias.some(p => p.campo.includes("QuantidadeTributavel"))).toBe(true);
    expect(plano.pendencias.some(p => p.campo.endsWith(".Imposto") && p.motivo.includes("alíquotas"))).toBe(true);
    expect(JSON.stringify(payload)).toBe(anterior);
    expect(plano.notaParcial).not.toHaveProperty("Serie"); expect(plano.notaParcial).not.toHaveProperty("Numero");
  });
  it("não inventa tributos nem completa produto pelo grupo fiscal", () => {
    const p = snapshotFicticio(); p.itens[0].fiscal.produto = {};
    const plano = prepararMapeamentoBrasilNfe(p, contexto), item = plano.notaParcial.Produtos[0];
    expect(item.NCM).toBeUndefined(); expect(item.CFOP).toBeUndefined(); expect(item.Imposto.ICMS).toEqual({});
    expect(plano.pendencias.some(p => p.campo.endsWith(".ncm") && p.responsavel === "REVISAO_FISCAL")).toBe(true);
    expect(plano.pendencias.some(p => p.campo.endsWith(".CEST"))).toBe(true);
  });
  it.each(["", "12345671", "00000000"])("GTIN %s fica pendente e não vira SEM GTIN nem usa código do grupo", ean => {
    const p = snapshotFicticio(); p.itens[0].fiscal.produto.ean = ean;
    Object.assign(p.itens[0].fiscal.grupo, { ean: "12345670" });
    const anterior = JSON.stringify(p), plano = prepararMapeamentoBrasilNfe(p, contexto);
    expect(plano.notaParcial.Produtos[0].EAN).toBeUndefined(); expect(plano.transmissaoPermitida).toBe(false);
    expect(plano.pendencias).toContainEqual(expect.objectContaining({ campo: "Produtos[0].ean", responsavel: "REVISAO_FISCAL" }));
    expect(JSON.stringify(p)).toBe(anterior);
  });
  it("preserva acréscimos e reconstrói bruto sem aplicar desconto duas vezes", () => {
    const p = snapshotFicticio(); Object.assign(p.itens[0], { quantidade: "2", preco: "10.10", acrescimos: "3.15", desconto: "2.00", total: "24.50" });
    const plano = prepararMapeamentoBrasilNfe(p, contexto);
    expect(plano.notaParcial.Produtos[0]).toMatchObject({ ValorUnitario: "13.25", ValorTotal: "26.50", ValorDesconto: "2.00" });
    expect(plano.notaParcial).not.toHaveProperty("ValorDesconto");
  });
  it("bloqueia configuração inválida/CNPJ divergente e mantém plano produtivo sem transmissão", () => {
    expect(() => prepararMapeamentoBrasilNfe(snapshotFicticio(), { ...contexto, emitenteCnpj: "11111111111111" })).toThrow("inválido");
    const prod = prepararMapeamentoBrasilNfe(snapshotFicticio(), { ...contexto, ambiente: "PRODUCAO" });
    expect(prod.notaParcial.TipoAmbiente).toBe(1); expect(prod.transmissaoPermitida).toBe(false);
    const p = snapshotFicticio(); p.itens[0].quantidade = "1.0000001";
    expect(() => prepararMapeamentoBrasilNfe(p, contexto)).toThrow("inválido");
    p.itens[0].quantidade = "um"; expect(() => prepararMapeamentoBrasilNfe(p, contexto)).toThrow("inválido");
  });
  it("expõe CRT desconhecido, conflito CSOSN/CST e CFOP incompatível com NFC-e", () => {
    const p = snapshotFicticio(); p.itens[0].fiscal.produto.cstIcms = "00"; p.itens[0].fiscal.produto.cfop = "6102";
    const plano = prepararMapeamentoBrasilNfe(p, { ...contexto, crt: undefined, modelo: 65 });
    expect(plano.pendencias.some(p => p.campo === "emitente.CRT")).toBe(true);
    expect(plano.notaParcial.Produtos[0].Imposto.ICMS).toEqual({});
    expect(plano.pendencias.some(p => p.campo.endsWith(".CFOP"))).toBe(true);
    expect(plano.pendencias.some(p => p.campo === "NFCe.CSC")).toBe(true);
  });
});
