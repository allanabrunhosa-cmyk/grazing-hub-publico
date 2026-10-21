import { afterEach, describe, expect, it, vi } from "vitest";
import { dadosDocumentaisPilotoBrasilNfe, propostasPilotoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/proposta-piloto";

const variaveis = ["GRAZING_PILOTO_FISCAL_CNPJ", "GRAZING_PILOTO_FISCAL_IE", "GRAZING_PILOTO_FISCAL_COD_MUNICIPIO"] as const;

afterEach(() => vi.unstubAllEnvs());

describe("Binding privado do piloto fiscal", () => {
  it("recusa configuração ausente antes de fornecer qualquer dado cadastral", () => {
    for (const nome of variaveis) vi.stubEnv(nome, "");
    expect(() => dadosDocumentaisPilotoBrasilNfe.cnpj).toThrow("GRAZING_PILOTO_FISCAL_CNPJ");
    expect(() => dadosDocumentaisPilotoBrasilNfe.ie).toThrow("GRAZING_PILOTO_FISCAL_IE");
    expect(() => dadosDocumentaisPilotoBrasilNfe.codMunicipio).toThrow("GRAZING_PILOTO_FISCAL_COD_MUNICIPIO");
  });

  it("lê o binding fictício explícito sem criar aprovação ou mudar o ambiente", () => {
    vi.stubEnv(variaveis[0], " 11222333000181 ");
    vi.stubEnv(variaveis[1], "123456789012");
    vi.stubEnv(variaveis[2], "3550308");
    expect({ ...dadosDocumentaisPilotoBrasilNfe }).toEqual({ cnpj: "11222333000181", ie: "123456789012", codMunicipio: "3550308" });
    const propostas = propostasPilotoBrasilNfe(55, "produto-ficticio", "forma-ficticia", dadosDocumentaisPilotoBrasilNfe);
    expect(propostas).toHaveLength(3);
    expect(propostas.every(p => p.revisao === 0 && p.modelo === 55)).toBe(true);
    expect(propostas.find(p => p.conteudo.tipo === "EMPRESA")?.conteudo).toMatchObject({ emitente: { ie: "123456789012", codMunicipio: "3550308" } });
  });

  it.each(variaveis)("recusa valor malformado de %s sem expor seu conteúdo", nome => {
    vi.stubEnv(nome, "valor-invalido-exclusivo-do-teste");
    const ler = nome.endsWith("CNPJ") ? () => dadosDocumentaisPilotoBrasilNfe.cnpj : nome.endsWith("_IE") ? () => dadosDocumentaisPilotoBrasilNfe.ie : () => dadosDocumentaisPilotoBrasilNfe.codMunicipio;
    expect(ler).toThrow(nome);
    expect(ler).not.toThrow("valor-invalido-exclusivo-do-teste");
  });

  it("mantém a configuração tardia e não fixa um valor durante a importação", () => {
    vi.stubEnv(variaveis[0], "11222333000181");
    expect(dadosDocumentaisPilotoBrasilNfe.cnpj).toBe("11222333000181");
    vi.stubEnv(variaveis[0], "");
    expect(() => dadosDocumentaisPilotoBrasilNfe.cnpj).toThrow(variaveis[0]);
  });
});
