import { describe, expect, it } from "vitest";
import { limitesEfetivos, validarGrupo, validarProduto } from "@/lib/vendas/dominio";
import { ehEscolhaInterna, limitarPorTipo, tipoComplemento } from "@/lib/vendas/tipos-complemento";
import { produtoTeste } from "./dominio.test";

const grupo = { id: "", versao: 0, nome: "Sabores das tortas", tipo: "OPCAO", minimo: 3, maximo: 99, repetir: true, ativo: true, opcoes: [{ id: "opcao", nome: "Palmito", preco: "0", quantidade: "1", produtoId: null, ativo: true }] };

describe("tipos de complemento", () => {
  it("Opção aceita uma única escolha e não repete, seja qual for o limite enviado", () => {
    expect(validarGrupo(grupo)).toMatchObject({ tipo: "OPCAO", minimo: 1, maximo: 1, repetir: false });
    expect(validarGrupo({ ...grupo, minimo: 0, maximo: null })).toMatchObject({ minimo: 0, maximo: 1 });
  });
  it("o vínculo do produto não amplia o limite de uma Opção", () => {
    const vinculo = { grupoId: "g", usarPadrao: false, minimo: 2, maximo: 5, opcoesExcluidas: [] };
    expect(limitesEfetivos({ tipo: "OPCAO", minimo: 0, maximo: 1 }, vinculo)).toEqual({ minimo: 1, maximo: 1 });
    expect(limitesEfetivos({ tipo: "COMPOSICAO", minimo: 0, maximo: 1 }, vinculo)).toEqual({ minimo: 2, maximo: 5 });
    expect(limitesEfetivos({ tipo: "EXTRAS", minimo: 4, maximo: 4 }, vinculo)).toEqual({ minimo: 0, maximo: null });
  });
  it("Composição mantém os limites livres e recusa tipo desconhecido", () => {
    expect(validarGrupo({ ...grupo, tipo: "COMPOSICAO" })).toMatchObject({ minimo: 3, maximo: 99, repetir: true });
    expect(() => validarGrupo({ ...grupo, tipo: "VARIAVEL" })).toThrow("Tipo de grupo inválido.");
  });
  it("agrupa os valores gravados nos três tipos do responsável", () => {
    expect(["COMPOSICAO", "OPCAO", "COMPLEMENTAR", "EXTRAS"].map(tipoComplemento)).toEqual(["COMPOSICAO", "OPCAO", "ADICIONAL", "ADICIONAL"]);
    expect(["COMPOSICAO", "OPCAO", "COMPLEMENTAR", "EXTRAS"].map(ehEscolhaInterna)).toEqual([true, true, false, false]);
    expect(limitarPorTipo("COMPLEMENTAR", { minimo: 0, maximo: 99 })).toEqual({ minimo: 0, maximo: 99 });
  });
  it("produto é sempre vendido por unidade", () => {
    expect(validarProduto({ ...produtoTeste, unidade: "KG" }).unidade).toBe("UN");
    expect(validarProduto({ ...produtoTeste, unidade: undefined }).unidade).toBe("UN");
  });
});
