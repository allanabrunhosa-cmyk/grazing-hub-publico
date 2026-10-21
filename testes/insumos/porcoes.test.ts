import { describe, expect, it } from "vitest";
import { calcularPorcao, medidaPorcao, normalizarNomePorcao, selecionarPorcao, validarNomePorcao, validarPorcao, validarPorcaoComposicao, validarQuantidadePorcao } from "@/lib/insumos/porcoes";
import { permissaoEfetiva, recursoDaRota } from "@/lib/permissoes/catalogo";

describe("contrato de porções", () => {
  const referencia = selecionarPorcao({ id: "p", insumoId: "i", nome: "8 fatias", quantidadeMedida: "8", unidadeMedida: "fatias", quantidade: "0.1", unidade: "KG", versao: 1 });
  it.each([["0,5", "0.05", "4 fatias"], ["2", "0.2", "16 fatias"], ["1.25", "0.125", "10 fatias"]])("converte %s porções sem arredondar ingrediente ou medida", (numeroPorcoes, quantidade, observacaoPorcao) => {
    expect(calcularPorcao({ ...referencia, numeroPorcoes })).toEqual({ quantidade, observacaoPorcao });
  });
  it("recusa overflow, zero e produtos que exigiriam arredondamento", () => {
    for (const p of [{ ...referencia, numeroPorcoes: "0" }, { ...referencia, numeroPorcoes: "999999999" }, { ...referencia, quantidadeInsumo: "0.000000001", numeroPorcoes: "0.5" }]) expect(calcularPorcao(p)).toHaveProperty("erro");
  });
  it("valida a quantidade derivada e a unidade no servidor", () => {
    const porcao = { ...referencia, numeroPorcoes: "0,5" };
    expect(validarPorcaoComposicao(porcao, "0.05", "KG")).toMatchObject({ porcao: { numeroPorcoes: "0.5" } });
    expect(validarPorcaoComposicao(porcao, "0.1", "KG")).toHaveProperty("erro");
    expect(validarPorcaoComposicao(porcao, "0.05", "G")).toHaveProperty("erro");
    expect(validarPorcaoComposicao(null, "123456789.123456789", "KG")).toEqual({ porcao: null });
  });
  it("separa medidas legadas sem inferir conversões de estoque", () => {
    expect(medidaPorcao({ nome: "8 fatias padrão" })).toEqual({ quantidadeMedida: "8", unidadeMedida: "fatias padrão" });
    expect(medidaPorcao({ nome: "Pote pequeno" })).toEqual({ quantidadeMedida: "1", unidadeMedida: "Pote pequeno" });
  });
  it("cadastro estrutura medida e restringe unidade e número", () => {
    const entrada = { insumoId: "insumo", quantidade: "0.1", unidade: "KG", quantidadeMedida: "8", unidadeMedida: " fatias  padrão " };
    expect(validarPorcao(entrada)).toMatchObject({ porcao: { nome: "8 fatias padrão", quantidadeMedida: "8", unidadeMedida: "fatias padrão" } });
    for (const alteracao of [{ quantidadeMedida: "0" }, { quantidadeMedida: "8abc" }, { unidadeMedida: "" }, { unidadeMedida: "x".repeat(101) }, { unidadeMedida: "fatia\n" }]) expect(validarPorcao({ ...entrada, ...alteracao })).toHaveProperty("erro");
  });
  it.each(["0.000000001", "0.123456789", "999999999", "1.000000001"])("preserva quantidade %s sem arredondar", (quantidade) => {
    expect(validarQuantidadePorcao(quantidade)).toEqual({ quantidade });
  });
  it("aceita vírgula e normaliza zeros sem usar ponto flutuante para persistência", () => {
    expect(validarQuantidadePorcao("001,250000000")).toEqual({ quantidade: "1.25" });
  });
  it.each(["0", "-1", "0.0000000001", "1000000000", "1e-3", "1.000,2", "abc", "NaN", "Infinity", 2, null, "1\n2"])("rejeita quantidade inválida %s", (quantidade) => {
    expect(validarQuantidadePorcao(quantidade)).toHaveProperty("erro");
  });
  it("recusa a precisão que o DTO numérico da composição perderia", () => {
    expect(validarQuantidadePorcao("999999999.999999999")).toEqual({ erro: "Quantidade excede a precisão suportada pela composição." });
    expect(validarQuantidadePorcao("123456789.123456789")).toHaveProperty("erro");
  });
  it("normaliza nomes iguais e restringe tamanho e controles", () => {
    expect(normalizarNomePorcao("  8  Fatias Padrão  ")).toBe("8 fatias padrão");
    expect(validarNomePorcao("  8  Fatias Padrão  ")).toEqual({ nome: "8 Fatias Padrão", nomeNormalizado: "8 fatias padrão" });
    expect(validarNomePorcao("a".repeat(120))).toHaveProperty("nome");
    expect(validarNomePorcao("a".repeat(121))).toHaveProperty("erro");
    expect(validarNomePorcao("fatia\u200b")).toHaveProperty("erro");
    expect(validarNomePorcao("fatia\n1")).toHaveProperty("erro");
  });
  it("valida unidade, identificadores e versão recebidos", () => {
    const entrada = { insumoId: "insumo", nome: "fatia", quantidade: "0.01", unidade: "KG" };
    expect(validarPorcao(entrada)).toHaveProperty("porcao");
    for (const alteracao of [{ unidade: "fatia" }, { insumoId: "x';DROP" }, { id: "porcao" }, { id: "porcao", versao: 0 }]) {
      expect(validarPorcao({ ...entrada, ...alteracao })).toHaveProperty("erro");
    }
  });
  it("registra rota própria e não concede acesso implicitamente", () => {
    expect(recursoDaRota("/porcoes")).toBe("suprimentos.porcoes");
    expect(permissaoEfetiva({ insumos: ["visualizar", "adicionar"] }, {}, "suprimentos.porcoes", "adicionar")).toBe(false);
  });
});
