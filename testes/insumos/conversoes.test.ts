import { describe, expect, it } from "vitest";
import { validarConversoes, descreverConversao, descreverEquivalencia, fatorDaUnidade } from "@/lib/insumos/conversoes";
import { gerarHtmlContagem } from "@/app/(protegido)/inventario/contagem/impressao";
import { contagemTeste } from "../inventario/dados";

describe("Conversões do insumo", () => {
  it("aceita vários fatores explícitos e vírgula decimal", () => {
    expect(validarConversoes([{ unidade: "FD", fator: "10" }, { unidade: "PCT", fator: "0,5" }], "KG")).toEqual({ conversoes: [{ unidade: "FD", fator: 10 }, { unidade: "PCT", fator: 0.5 }] });
    expect(descreverConversao({ unidade: "FD", fator: 10 }, "KG")).toBe("1 fd = 10 kg");
    expect(descreverEquivalencia(2.5, 10, "KG")).toBe("25 kg");
  });
  it.each([0, -1, "", "10kg", "1e4", Infinity, NaN, 1_000_000_000, "0.0000001", null])("recusa fator inválido %s", (fator) => {
    expect(validarConversoes([{ unidade: "FD", fator }], "KG")).toHaveProperty("erro");
  });
  it("recusa unidade principal, unidade desconhecida, duplicidade e payload inválido", () => {
    for (const valor of [[{ unidade: "KG", fator: 10 }], [{ unidade: "UNIDADE_INEXISTENTE", fator: 10 }], [{ unidade: "FD", fator: 10 }, { unidade: "FD", fator: 20 }], {}, null, [null]]) {
      expect(validarConversoes(valor, "KG")).toHaveProperty("erro");
    }
  });
  it("não presume conversão quando ela não foi cadastrada", () => {
    expect(fatorDaUnidade("G", "KG", [])).toBeNull();
    expect(fatorDaUnidade("KG", "KG", [])).toBe(1);
    expect(fatorDaUnidade("FD", "KG", [{ unidade: "FD", fator: 10 }])).toBe(10);
  });
  it("imprime a referência nas observações sem preencher a quantidade contada", () => {
    const item = { ...contagemTeste.itens[0], unidade: "KG" as const, conversoes: [{ unidade: "FD" as const, fator: 10 }], quantidadeSistema: 1234, quantidadeContada: 5678 };
    const html = gerarHtmlContagem(contagemTeste, [item], "");
    expect(html).toContain('class="observacoes">1 fd = 10 kg</td>');
    expect(html).toContain('class="contagem"></td>');
    expect(html).not.toContain("1234");
    expect(html).not.toContain("5678");
  });
});
