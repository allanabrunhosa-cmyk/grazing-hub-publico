import { describe, expect, it } from "vitest";
import { gtinValido } from "@/lib/tributacao/gtin";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
describe("GTIN individual", () => {
  it.each(["12345670", "123456789012", "4006381333931", "10012345000017", "SEM GTIN"])("aceita formato/dígito válido ou ausência explícita: %s", codigo => {
    expect(gtinValido(codigo)).toBe(true);
  });
  it.each([null, undefined, "", "00000000", "4006381333932", "123456789", "SEM", "SEM GTIN\n", "789ABC1234567"])("recusa código inválido sem substituir por literal: %s", codigo => {
    expect(gtinValido(codigo)).toBe(false);
  });
  it("preserva ausência de campo legado, null pendente e código confirmado sem mudar NCM", () => {
    const d = { produtoId: "produto-ficticio", grupo: "GF06", natureza: "REVENDA", tratamento: "NORMAL", ncm: "19053100", origem: "0", cest: null, unidade: "UN", estado: "CONFIRMADO", evidencias: ["Mercadoria fictícia para teste de formato"], pendencias: [] };
    expect(validarDadosFiscais("CLASSIFICACAO", d)).not.toHaveProperty("gtin");
    expect(validarDadosFiscais("CLASSIFICACAO", { ...d, gtin: null })).toMatchObject({ ncm: "19053100", gtin: null });
    expect(validarDadosFiscais("CLASSIFICACAO", { ...d, gtin: "4006381333931" })).toMatchObject({ gtin: "4006381333931" });
    expect(() => validarDadosFiscais("CLASSIFICACAO", { ...d, gtin: "4006381333932" })).toThrow("GTIN");
  });
});
