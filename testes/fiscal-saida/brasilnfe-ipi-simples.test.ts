import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { prepararPayloadLocalBrasilNfe, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { hashRegraFiscalBrasilNfe, validarConteudoRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { rascunhoRegraSintetica } from "./brasilnfe-regras-tributarias-fixtures";

describe("Representação documental explícita de IPI no Simples", () => {
  it.each([55, 65] as const)("monta modelo%s sem inventar IPI ou mudar valores da fotografia", modelo => {
    const m = massaPayloadLocal(), anterior = structuredClone(m.documento);
    Object.assign(m.parametros.itens[0], { ipiAplicavel: true, representacaoIpi: "OMITIR_SIMPLES" });
    const r = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros);
    expect(r.pendencias).toEqual([]); expect(r.montagemConcluida).toBe(true);
    expect(r.payload!.Produtos[0].Imposto).not.toHaveProperty("IPI");
    expect(r.payload!.ValorTotal).toBe("24.53"); expect(m.documento).toEqual(anterior);
    expect(serializarPayloadLocalBrasilNfe(r)).not.toContain('"IPI"'); expect(r.transmissaoPermitida).toBe(false);
  });
  it("ausência da escolha conserva bloqueio do contrato legado", () => {
    const m = massaPayloadLocal(); m.parametros.itens[0].ipiAplicavel = true;
    const r = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros);
    expect(r.montagemConcluida).toBe(false); expect(r.pendencias.some(p => p.campo.endsWith("ipiAplicavel"))).toBe(true);
  });
  it("representação independente não inventa enquadramento federal ou Anexo do DAS", () => {
    const m = massaPayloadLocal(); Object.assign(m.parametros.itens[0], { ipiAplicavel: null, representacaoIpi: "OMITIR_SIMPLES" });
    expect(prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros).montagemConcluida).toBe(true);
    delete m.parametros.itens[0].representacaoIpi;
    expect(prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros).montagemConcluida).toBe(false);
  });
  it("nome fiscal do primeiro item65 segue o MOC sem alterar a descrição comercial", () => {
    const m = massaPayloadLocal(), nome = m.documento.payload.itens[0].produto.nome;
    const r = prepararPayloadLocalBrasilNfe(m.documento, 65, m.cadastro, m.parametros);
    expect(r.payload!.Produtos[0].NmProduto).toBe("NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL");
    expect(m.documento.payload.itens[0].produto.nome).toBe(nome);
    expect(prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros).payload!.Produtos[0].NmProduto).toBe(nome);
  });
  it("não descarta CST preenchido nem aplica omissão ao regime normal", () => {
    const m = massaPayloadLocal(); Object.assign(m.parametros.itens[0], { ipiAplicavel: true, representacaoIpi: "OMITIR_SIMPLES" });
    m.documento.payload.itens[0].fiscal.produto.ipi = "53";
    expect(prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros).pendencias.some(p => p.codigo === "DIVERGENTE")).toBe(true);
    m.documento.payload.itens[0].fiscal.produto.ipi = ""; m.parametros.emitente.crt = 3;
    expect(prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros).pendencias.some(p => p.campo.endsWith("representacaoIpi"))).toBe(true);
  });
  it("não acrescenta campo nem altera hash de conteúdo histórico; rejeita modo desconhecido", () => {
    const d = rascunhoRegraSintetica("PRODUTO").conteudo, h = hashRegraFiscalBrasilNfe(d);
    expect(hashRegraFiscalBrasilNfe(validarConteudoRegraFiscalBrasilNfe(d, "PRODUTO"))).toBe(h);
    if (d.tipo !== "ITEM") throw new Error("Fixture inválida.");
    expect(() => validarConteudoRegraFiscalBrasilNfe({ ...d, perfil: { ...d.perfil, representacaoIpi: "AUTOMATICO" } }, "PRODUTO")).toThrow();
    expect(validarConteudoRegraFiscalBrasilNfe({ ...d, perfil: { ...d.perfil, representacaoIpi: "OMITIR_SIMPLES" } }, "PRODUTO")).toHaveProperty("perfil.representacaoIpi", "OMITIR_SIMPLES");
  });
});
