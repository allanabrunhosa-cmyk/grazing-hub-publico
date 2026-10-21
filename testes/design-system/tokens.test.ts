import { describe, expect, it } from "vitest";
import { declaracoesCssTema, gerarCssTema } from "@/lib/design-system/gerar-css";
import { chavesDoGrupo, REGISTRO_TOKENS, VALORES_FABRICA } from "@/lib/design-system/registro";
import { restaurarGrupo, restaurarToken, resolverTema } from "@/lib/design-system/resolver-tema";
import { contrasteHex, ErroValidacaoTema, validarValoresTema } from "@/lib/design-system/validacao";

describe("registro de tokens da Central de Design", () => {
  it("completa temas antigos com salvamento laranja e garante contraste nos dois modos", () => {
    const legado = resolverTema({ "cor.hub.primariaClara": "#0b5fc4" });
    expect(contrasteHex(legado["acao.salvarClaro"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrasteHex(legado["acao.salvarEscuro"], "#0b1d37")).toBeGreaterThanOrEqual(4.5);
    expect(declaracoesCssTema(legado)).toContainEqual({ propriedade: "--ds-salvar-claro", valor: legado["acao.salvarClaro"] });
    expect(() => validarValoresTema({ "acao.salvarClaro": "#ff0000" })).toThrow(ErroValidacaoTema);
  });
  it("resolve exatamente os valores de fábrica mapeados", () => {
    expect(resolverTema()).toEqual(VALORES_FABRICA);
    expect(VALORES_FABRICA["controle.altura"]).toBe("2.75rem");
    expect(VALORES_FABRICA["botao.raio"]).toBe("9999px");
    expect(VALORES_FABRICA["menu.largura"]).toBe("16rem");
    expect(VALORES_FABRICA["cor.hub.primariaClara"]).toBe("#0865d5");
    expect(VALORES_FABRICA["tipografia.familia"]).toContain("Segoe UI");
  });

  it("aceita somente uma opção publicada para cada token", () => {
    expect(resolverTema({ "controle.altura": "3rem" })["controle.altura"]).toBe("3rem");
    expect(resolverTema({ "cor.etiquetas.primariaClara": "#c84a10" })["cor.etiquetas.primariaClara"]).toBe("#c84a10");
    expect(() => validarValoresTema({ "controle.altura": "calc(100vh)" })).toThrow(ErroValidacaoTema);
    expect(() => validarValoresTema({ "--cor-livre": "red" })).toThrow(ErroValidacaoTema);
  });

  it("gera CSS estável somente a partir do registro", () => {
    const declaracoes = declaracoesCssTema({ "movimento.rapido": "0ms" });
    expect(declaracoes).toHaveLength(Object.keys(REGISTRO_TOKENS).length);
    expect(declaracoes).toContainEqual({ propriedade: "--ds-controle-altura", valor: "2.75rem" });
    expect(declaracoes).toContainEqual({ propriedade: "--ds-hub-primaria-clara", valor: "#0865d5" });
    expect(gerarCssTema({ "movimento.rapido": "0ms" })).toContain("--ds-movimento-rapido: 0ms;");
  });

  it("restaura um campo ou grupo sem tocar em outros rascunhos", () => {
    const rascunho = { "controle.altura": "3rem", "controle.raio": "0.5rem", "menu.largura": "18rem" };
    expect(restaurarToken(rascunho, "controle.altura")).toEqual({ "controle.raio": "0.5rem", "menu.largura": "18rem" });
    expect(restaurarGrupo(rascunho, "controles")).toEqual({ "menu.largura": "18rem" });
    expect(chavesDoGrupo("controles")).toContain("controle.raio");
  });
});
