import { describe, expect, it } from "vitest";
import { UnidadeMedida } from "@/generated/prisma/browser";
import { validarConversoes, descreverConversao } from "@/lib/insumos/conversoes";
import { unidadeMedidaLabels, unidadeMedidaAbreviada } from "@/lib/labels";

describe("embalagens de compra", () => {
  it.each([
    [UnidadeMedida.BALDE, 2, "balde"],
    [UnidadeMedida.GALAO, 5, "galão"],
    [UnidadeMedida.PECA, 3, "peça"],
    [UnidadeMedida.BAG, 1.02, "bag"],
    [UnidadeMedida.GARRAFA, 0.9, "garrafa"],
    [UnidadeMedida.LATA, 0.17, "lata"],
  ] as const)("aceita %s e apresenta sua equivalência", (unidade, fator, nome) => {
    const conversao = { unidade, fator };
    expect(validarConversoes([conversao], UnidadeMedida.KG)).toEqual({ conversoes: [conversao] });
    expect(descreverConversao(conversao, UnidadeMedida.KG)).toContain(nome);
    expect(unidadeMedidaLabels[unidade]).toBeTruthy();
    expect(unidadeMedidaAbreviada[unidade]).toBe(nome);
  });
});
