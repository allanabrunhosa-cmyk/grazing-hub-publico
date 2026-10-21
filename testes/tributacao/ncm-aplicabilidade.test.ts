import { describe, expect, it } from "vitest";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";

function classificacao(extra: Partial<ClassificacaoFiscal> = {}): ClassificacaoFiscal {
  return { produtoId: "ficticio", grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL", ncm: "08061000", origem: "0", cest: null, unidade: "UN", estado: "PENDENTE", evidencias: ["Documento exclusivamente sintético"], pendencias: ["Origem operacional a conferir"], ncmAplicabilidade: "APLICAVEL", analiseNcm: { fundamento: "DOCUMENTAL", confianca: "ALTA", descricaoNcm: "Uvas frescas — descrição sintética", dataAnalise: "2026-10-11", justificativa: "Identidade da mercadoria exclusivamente fictícia comprovada no documento de teste", fontes: ["documento-ficticio"], pendenciasNcm: [] }, ...extra };
}
describe("Aplicabilidade e fundamentação do NCM", () => {
  it("separa NCM concluído das pendências operacionais", () => {
    const c = classificacao(); expect(validarDadosFiscais("CLASSIFICACAO", c)).toEqual(c);
  });
  it("conserva compatibilidade de versões históricas sem os novos metadados", () => {
    const c = classificacao(); delete c.ncmAplicabilidade; delete c.analiseNcm;
    expect(validarDadosFiscais("CLASSIFICACAO", c)).toEqual(c);
  });
  it("exige lista explícita de pendências de NCM e prova para confiança alta/média", () => {
    const c = classificacao(); const a = c.analiseNcm!;
    for (const analiseNcm of [{ ...a, pendenciasNcm: undefined }, { ...a, pendenciasNcm: ["Formulação não comprovada"] }, { ...a, fontes: [] }, { ...a, justificativa: "" }, { ...a, dataAnalise: "2999-01-01" }]) expect(() => validarDadosFiscais("CLASSIFICACAO", { ...c, analiseNcm })).toThrow();
  });
  it("confiança baixa permanece pendente e não vira classificação confirmada", () => {
    const c = classificacao(), analiseNcm = { ...c.analiseNcm!, confianca: "BAIXA", pendenciasNcm: ["Identidade não comprovada"] };
    expect(validarDadosFiscais("CLASSIFICACAO", { ...c, analiseNcm })).toMatchObject({ estado: "PENDENTE" });
    expect(() => validarDadosFiscais("CLASSIFICACAO", { ...c, analiseNcm, estado: "CONFIRMADO", pendencias: [] })).toThrow();
  });
  it("N/A exige justificativa, ausência de NCM canônico e tratamento compatível", () => {
    const c = classificacao(), analiseNcm = { ...c.analiseNcm!, descricaoNcm: null };
    expect(validarDadosFiscais("CLASSIFICACAO", { ...c, ncm: null, tratamento: "OPCAO_CONFIGURACAO", ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm })).toMatchObject({ ncm: null, ncmAplicabilidade: "NAO_APLICAVEL" });
    for (const extra of [{ ncm: "08061000", tratamento: "OPCAO_CONFIGURACAO" }, { ncm: null, tratamento: "NORMAL" }]) expect(() => validarDadosFiscais("CLASSIFICACAO", { ...c, ...extra, ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm })).toThrow();
  });
  it("kit confirmado não exige grupo GF único nem NCM do conjunto", () => {
    const c = classificacao(); expect(validarDadosFiscais("CLASSIFICACAO", { ...c, grupo: null, ncm: null, tratamento: "KIT_COMPOSTO", estado: "CONFIRMADO", pendencias: [], ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: { ...c.analiseNcm!, descricaoNcm: null }, componentesKit: [{ produtoId: "mercadoria-ficticia", quantidade: "1", pesoRateio: "1" }] })).toMatchObject({ grupo: null, ncm: null });
  });
  it("ficha física final admite nove casas sem ampliar quantidade do KIT e exige fontes/identidade compatível", () => {
    const c = classificacao({ natureza: "PREPARADO", receitaFiscalDocumentada: { componentesFixos: [{ insumoId: "ingrediente-ficticio", unidade: "KG", quantidade: "0.056666667" }], opcoes: [], justificativa: "Porção final exclusivamente sintética documentada", fontes: ["ficha-ficticia"] } });
    expect(validarDadosFiscais("CLASSIFICACAO", c)).toMatchObject({ receitaFiscalDocumentada: { componentesFixos: [{ quantidade: "0.056666667" }] } });
    for (const quantidade of ["0", "0.0566666667", "-1", "1e-9"]) expect(() => validarDadosFiscais("CLASSIFICACAO", { ...c, receitaFiscalDocumentada: { ...c.receitaFiscalDocumentada!, componentesFixos: [{ insumoId: "ingrediente-ficticio", unidade: "KG", quantidade }] } })).toThrow();
    for (const mudar of [{ natureza: "REVENDA" }, { receitaFiscalDocumentada: { ...c.receitaFiscalDocumentada!, fontes: [] } }, { receitaFiscalDocumentada: { ...c.receitaFiscalDocumentada!, componentesFixos: [] } }]) expect(() => validarDadosFiscais("CLASSIFICACAO", { ...c, ...mudar })).toThrow();
    const kit = classificacao({ tratamento: "KIT_COMPOSTO", componentesKit: [{ produtoId: "mercadoria-ficticia", quantidade: "0.056666667", pesoRateio: "1" }] }); expect(() => validarDadosFiscais("CLASSIFICACAO", kit)).toThrow("Quantidade do kit");
    expect(() => validarDadosFiscais("CLASSIFICACAO", { ...classificacao(), baseSemIngredientesComprovada: true })).toThrow("Base sem ingredientes exige");
  });
});
