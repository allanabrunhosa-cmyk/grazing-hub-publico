import { describe, expect, it } from "vitest";
import { lerAjustesOpcoes, opcoesEfetivas, validarComponentes, validarGrupo, simularConfiguracao, precoObrigatorioNaConfiguracao } from "@/lib/vendas/dominio";
import { composicaoDaOpcao } from "@/lib/vendas/complementos";
const componente = { insumoId: "salame", unidade: "KG", quantidade: "0.05" };
const opcao = { id: "salame", nome: "Salame", produtoId: "p", quantidade: "1", ativo: true, preco: "10" };
const grupo = { id: "g", versao: 1, nome: "Extras", tipo: "COMPOSICAO" as const, minimo: 1, maximo: 1, repetir: false, ativo: true, opcoes: [opcao] };
const vinculo = { grupoId: "g", usarPadrao: false, minimo: 1, maximo: 1, ajustesOpcoes: [{ opcaoId: "salame", preco: "0", composicao: [{ ...componente, quantidade: "0.2" }] }] };
describe("complementos por grupo e produto", () => {
  it("escolha grátis substitui preço/composição e não modifica o padrão", () => {
    const efetiva = opcoesEfetivas(grupo.opcoes, vinculo)[0];
    expect(efetiva).toMatchObject({ preco: "0", composicao: [{ quantidade: "0.2" }] });
    expect(simularConfiguracao("100", [{ ...grupo, vinculo }], { salame: 1 })).toMatchObject({ valido: true, totalCentavos: 10000 });
    expect(precoObrigatorioNaConfiguracao([grupo], [vinculo])).toBe(false);
    expect(opcao.preco).toBe("10");
  });
  it("pausa local e exclusão bloqueiam seleção; ajuste local não reativa pausa global", () => {
    for (const v of [{ ...vinculo, ajustesOpcoes: [{ opcaoId: "salame", ativo: false }] }, { ...vinculo, opcoesExcluidas: ["salame"] }]) expect(simularConfiguracao("100", [{ ...grupo, vinculo: v }], { salame: 1 }).valido).toBe(false);
    expect(opcoesEfetivas([{ ...opcao, ativo: false }], { ajustesOpcoes: [{ opcaoId: "salame", ativo: true }] })[0].ativo).toBe(false);
  });
  it("composição própria é por escolha e não reaplica o multiplicador legado", () => {
    expect(composicaoDaOpcao({ ...opcao, quantidade: "4", composicao: [componente] }, [])).toEqual([componente]);
  });
  it("valida centavos, quantidade positiva, duplicatas e snapshots de porção no servidor", () => {
    expect(validarGrupo({ ...grupo, opcoes: [{ ...opcao, composicao: [componente] }] }).opcoes[0].composicao).toMatchObject([componente]);
    for (const preco of ["-1", "0.001", "abc"]) expect(() => lerAjustesOpcoes([{ opcaoId: "salame", preco }])).toThrow();
    expect(() => lerAjustesOpcoes([{ opcaoId: "salame" }, { opcaoId: "salame" }])).toThrow();
    expect(() => validarComponentes([{ ...componente, quantidade: "0" }])).toThrow();
    expect(() => validarComponentes([componente, componente])).toThrow();
  });
});
