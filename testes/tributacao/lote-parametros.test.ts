import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { validarLoteParametrosFiscais, type LoteParametrosFiscais } from "@/lib/tributacao/lote-parametros";
import { hojeFiscal } from "@/lib/tributacao/validacao";
import { consultarTabelaFiscal } from "@/lib/fiscal/catalogos/consulta";

const lote = (): LoteParametrosFiscais => ({ loteId: "parametros-sinteticos", vigenciaInicio: hojeFiscal(), perfilHash: "a".repeat(64), grupos: [], produtos: [{ id: "sintetico", versao: 1, justificativa: "Regra de venda sintética com fundamentação individual.", fiscal: { ncm: "04061010", origem: "0", cfop: "5102", csosn: "102", pis: "99", cofins: "99", unidadeTributavel: "UN", ean: "SEM GTIN" } }], versoes: [] });
describe("Parâmetros fiscais em lote", () => {
  it("oferece UN e L no cadastro doméstico sem inventar regra de exportação", () => {
    for (const codigo of ["UN", "L"]) {
      expect(consultarTabelaFiscal({ tabela: "unidadeTributavel", selecionado: codigo, operacao: "INTERNA" }).selecionado?.vigente).toBe(true);
      expect(consultarTabelaFiscal({ tabela: "unidadeTributavel", selecionado: codigo, operacao: "EXTERIOR" }).selecionado?.vigente).toBe(false);
    }
  });
  it("preserva zeros à esquerda e separa código de recomendação", () => {
    const e = lote(); expect(validarLoteParametrosFiscais(e).produtos[0].fiscal).toMatchObject({ ncm: "04061010", origem: "0", pis: "99" });
    e.produtos[0].fiscal.ncm = "Definido por produto"; expect(() => validarLoteParametrosFiscais(e)).toThrow();
  });
  it.each(["preco", "estoque", "tipoOperacao", "crt", "cest", "cstIcms", "cClassTrib"])("não permite alterar %s pelo lote cadastral", campo => {
    const e = lote(); e.produtos[0].fiscal[campo] = "0"; expect(() => validarLoteParametrosFiscais(e)).toThrow();
  });
  it.each([["5101", "500"], ["5405", "102"], ["6102", "102"], ["5102", "400"]])("rejeita combinação %s / %s", (cfop, csosn) => {
    const e = lote(); Object.assign(e.produtos[0].fiscal, { cfop, csosn }); expect(() => validarLoteParametrosFiscais(e)).toThrow();
  });
  it.each([["5101", "102"], ["5102", "102"], ["5405", "500"], ["5102", "900"]])("aceita combinação delimitada %s / %s", (cfop, csosn) => {
    const e = lote(); Object.assign(e.produtos[0].fiscal, { cfop, csosn }); expect(() => validarLoteParametrosFiscais(e)).not.toThrow();
  });
  it("rejeita retroatividade, duplicidade, GTIN fictício e código inexistente", () => {
    for (const editar of [(e: LoteParametrosFiscais) => { e.vigenciaInicio = "2026-01-01"; }, (e: LoteParametrosFiscais) => { e.produtos.push(e.produtos[0]); }, (e: LoteParametrosFiscais) => { e.produtos[0].fiscal.ean = "1234567890123"; }, (e: LoteParametrosFiscais) => { e.produtos[0].fiscal.origem = "9"; }]) {
      const e = lote(); editar(e); expect(() => validarLoteParametrosFiscais(e)).toThrow();
    }
  });
});
