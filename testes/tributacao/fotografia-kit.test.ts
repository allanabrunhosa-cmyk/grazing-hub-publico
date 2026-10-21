import { describe, expect, it } from "vitest";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";
import { conferirPoliticaKit, fotografarPoliticaKit } from "@/lib/tributacao/fotografia-kit";

// Identidades, receitas e hashes inteiramente fictícios; nenhum acesso ao banco.
const materiais = () => ({ algoritmo: "grazing.material-fiscal.v1" as const, insumos: [{ insumoId: "ingrediente_ficticio", hash: "a".repeat(64), transitiva: false }] });
const receita = (escolhas: string[] = []) => ({ principalHash: "b".repeat(64), opcaoHashes: escolhas.map(opcaoId => ({ opcaoId, hash: "c".repeat(64) })), materiais: { principal: materiais(), opcoes: escolhas.map(opcaoId => ({ opcaoId, materiais: materiais() })) } });
function kit(): ClassificacaoFiscal {
  return { produtoId: "kit_ficticio", grupo: "GF06", natureza: "REVENDA", tratamento: "KIT_COMPOSTO", ncm: null, origem: null, cest: null, unidade: "UN", estado: "CONFIRMADO", evidencias: [], pendencias: [], componentesKit: [
    { produtoId: "produto_ficticio", descricao: "Mercadoria fictícia", unidade: "UN", quantidade: "1", pesoRateio: "2", escolhas: [{ opcaoId: "sabor_b", grupoId: "sabores", quantidade: "1" }, { opcaoId: "sabor_a", grupoId: "sabores", quantidade: "2" }], receitaFotografada: receita(["sabor_b", "sabor_a"]) },
    { referenciaInternaInsumoId: "preparacao_ficticia", descricao: "Preparação final fictícia", unidade: "UN", quantidade: "2", pesoRateio: "1", receitaFotografada: receita() },
  ] };
}
describe("Fotografia independente da política do kit vendido", () => {
  it("preserva conteúdo, ordem e receitas originais ao salvar versões futuras", () => {
    const c = kit(), foto = fotografarPoliticaKit(c, "versao_original");
    expect(conferirPoliticaKit(c, foto)).toBe(true);
    expect(foto.componentes).toEqual(c.componentesKit);
    expect(foto.componentes).not.toBe(c.componentesKit);
    c.componentesKit![0].receitaFotografada!.materiais!.principal.insumos[0].hash = "d".repeat(64);
    c.componentesKit![0].receitaFotografada!.principalHash = "e".repeat(64);
    const futura = fotografarPoliticaKit(c, "versao_futura");
    expect(futura.hashPolitica).toBe(foto.hashPolitica);
    expect(conferirPoliticaKit(c, foto)).toBe(true);
    expect(foto.componentes[0].receitaFotografada!.principalHash).toBe("b".repeat(64));
    expect(foto.componentes[0].receitaFotografada!.materiais!.principal.insumos[0].hash).toBe("a".repeat(64));
  });
  it("normaliza decimais/ordem de escolhas sem alterar o clone ou precisão global", () => {
    const c = kit(), foto = fotografarPoliticaKit(c, "versao_original");
    c.componentesKit![0].quantidade = "1.000000";
    c.componentesKit![0].pesoRateio = "2.000000";
    c.componentesKit![0].escolhas!.reverse();
    c.componentesKit![0].escolhas![0].quantidade = "2.000000";
    c.componentesKit!.reverse();
    expect(conferirPoliticaKit(c, foto)).toBe(true);
    expect(foto.componentes[0].quantidade).toBe("1");
    expect(foto.componentes[0].escolhas!.map(e => e.opcaoId)).toEqual(["sabor_b", "sabor_a"]);
  });
  it.each(["produtoId", "quantidade", "pesoRateio", "descricao", "unidade"] as const)("nova %s exige revisão da operação original", campo => {
    const c = kit(), foto = fotografarPoliticaKit(c, "versao_original");
    c.componentesKit![0][campo] = campo === "quantidade" || campo === "pesoRateio" ? "3" : campo === "unidade" ? "KG" : "mudanca_ficticia";
    expect(conferirPoliticaKit(c, foto)).toBe(false);
  });
  it("mudança de quantidade/grupo/opção ou referência interna altera a política", () => {
    for (const campo of ["quantidade", "grupoId", "opcaoId"] as const) {
      const c = kit(), foto = fotografarPoliticaKit(c, "versao_original");
      c.componentesKit![0].escolhas![0][campo] = campo === "quantidade" ? "3" : "outra_identidade";
      expect(conferirPoliticaKit(c, foto)).toBe(false);
    }
    const c = kit(), foto = fotografarPoliticaKit(c, "versao_original");
    c.componentesKit![1].referenciaInternaInsumoId = "outra_preparacao";
    expect(conferirPoliticaKit(c, foto)).toBe(false);
  });
  it.each([undefined, null, {}, { algoritmo: "outro" }, { algoritmo: "grazing.kit-fiscal.v1", hashPolitica: "a".repeat(64), classificacaoVersaoId: "versao", componentes: [] }])("não promove fotografia legada/malformada %#", foto => {
    expect(conferirPoliticaKit(kit(), foto)).toBe(false);
  });
  it("não aceita hash adulterado nem conteúdo alterado com hash antigo", () => {
    const c = kit(), foto = fotografarPoliticaKit(c, "versao_original");
    foto.hashPolitica = "f".repeat(64); expect(conferirPoliticaKit(c, foto)).toBe(false);
    const outra = fotografarPoliticaKit(c, "versao_original"); outra.componentes[0].quantidade = "9";
    expect(conferirPoliticaKit(c, outra)).toBe(false);
    expect(conferirPoliticaKit(c, { ...fotografarPoliticaKit(c, "versao_original"), classificacaoVersaoId: "" })).toBe(false);
  });
  it.each(["0", "-1", "1e2", "1,2", "NaN", "Infinity", "0.0000001", "1000000000000"])("recusa quantidade/rateio fora do domínio %s", valor => {
    const c = kit(); c.componentesKit![0].quantidade = valor;
    expect(() => fotografarPoliticaKit(c, "versao")).toThrow("Kit sem fotografia íntegra");
    c.componentesKit![0].quantidade = "1"; c.componentesKit![0].pesoRateio = valor;
    expect(() => fotografarPoliticaKit(c, "versao")).toThrow("Kit sem fotografia íntegra");
  });
  it("não aceita referências ambíguas/duplicadas nem receita ausente", () => {
    const c = kit(); c.componentesKit![0].referenciaInternaInsumoId = "outro_insumo";
    expect(() => fotografarPoliticaKit(c, "versao")).toThrow();
    const duplicado = kit(); duplicado.componentesKit!.push(structuredClone(duplicado.componentesKit![0]));
    expect(() => fotografarPoliticaKit(duplicado, "versao")).toThrow();
    const semReceita = kit(); delete semReceita.componentesKit![0].receitaFotografada;
    expect(() => fotografarPoliticaKit(semReceita, "versao")).toThrow();
    const comNormal = kit(); comNormal.tratamento = "NORMAL";
    expect(() => fotografarPoliticaKit(comNormal, "versao")).toThrow();
  });
  it("não aceita materiais ou hashes de escolhas ausentes/duplicados no snapshot", () => {
    const c = kit(), foto = fotografarPoliticaKit(c, "versao");
    delete foto.componentes[0].receitaFotografada!.materiais;
    expect(conferirPoliticaKit(c, foto)).toBe(false);
    const outra = fotografarPoliticaKit(c, "versao"); outra.componentes[0].receitaFotografada!.opcaoHashes[1].opcaoId = "sabor_b";
    expect(conferirPoliticaKit(c, outra)).toBe(false);
    const material = fotografarPoliticaKit(c, "versao"); material.componentes[0].receitaFotografada!.materiais!.principal.insumos[0].hash = "invalido";
    expect(conferirPoliticaKit(c, material)).toBe(false);
  });
});
