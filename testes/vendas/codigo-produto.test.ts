import { describe, expect, it } from "vitest";
import { codigoProdutoValido, lerEstadoCodigosProdutos, prepararFamiliasCodigos, proximoCodigoProduto, registrarCodigosExistentes } from "@/lib/vendas/codigo-produto";
import { validarProduto } from "@/lib/vendas/dominio";
const categorias = [{ id: "cafe", nome: "Café", escopo: "PRODUTO", ordem: 1 }, { id: "tabuas", nome: "Tábuas", escopo: "PRODUTO", ordem: 0 }];
describe("código comercial hierárquico", () => {
  it.each(["P0100001", "C0000001", "ABC123", "12345678"])("aceita letras e números até oito: %s", c => expect(codigoProdutoValido(c)).toBe(true));
  it.each(["", "123456789", "sku-1", "á123", "abc", "A B", "<script>", null, 123])("recusa código inválido: %s", c => expect(codigoProdutoValido(c)).toBe(false));
  it("atribui família pela ordem do catálogo e sequência independente", () => {
    const e = prepararFamiliasCodigos(lerEstadoCodigosProdutos(null), categorias);
    expect(proximoCodigoProduto(e, "PRINCIPAL", ["cafe"])).toBe("P0200001");
    expect(proximoCodigoProduto(e, "PRINCIPAL", ["tabuas", "cafe"])).toBe("P0100001");
    expect(proximoCodigoProduto(e, "PRINCIPAL", [])).toBe("P0000001");
    expect(proximoCodigoProduto(e, "COMPLEMENTO", [])).toBe("C0000001");
  });
  it("não renumera famílias ao reordenar, renomear ou remover categorias", () => {
    const antes = prepararFamiliasCodigos(lerEstadoCodigosProdutos(null), categorias);
    const depois = prepararFamiliasCodigos(antes, [{ ...categorias[0], nome: "Novo nome", ordem: 0 }, { id: "nova", nome: "Nova", escopo: "PRODUTO", ordem: -1 }]);
    expect(depois.categorias.cafe.numero).toBe(2);
    expect(depois.categorias.tabuas.numero).toBe(1);
    expect(depois.categorias.nova.numero).toBe(3);
  });
  it("não reutiliza último número após exclusão nem colide com código existente", () => {
    const e = prepararFamiliasCodigos(lerEstadoCodigosProdutos(null), categorias);
    registrarCodigosExistentes(e, ["P0200042", "LEG1", null]);
    expect(proximoCodigoProduto(e, "PRINCIPAL", ["cafe"])).toBe("P0200043");
    const salvo = lerEstadoCodigosProdutos(JSON.parse(JSON.stringify(e)));
    registrarCodigosExistentes(salvo, []);
    expect(proximoCodigoProduto(salvo, "PRINCIPAL", ["cafe"])).toBe("P0200044");
  });
  it("falha explicitamente no esgotamento, sem reduzir ou zerar sequência", () => {
    const e = lerEstadoCodigosProdutos({ versao: 1, categorias: {}, ultimos: { P00: 99999 } });
    expect(() => proximoCodigoProduto(e, "PRINCIPAL", [])).toThrow("99999");
    expect(e.ultimos.P00).toBe(99999);
  });
  it.each([{ versao: 2, categorias: {}, ultimos: {} }, { versao: 1, categorias: { a: { escopo: "PRODUTO", numero: 1 }, b: { escopo: "PRODUTO", numero: 1 } }, ultimos: {} }, { versao: 1, categorias: {}, ultimos: { P00: -1 } }])("recusa registro inconsistente", e => expect(() => lerEstadoCodigosProdutos(e)).toThrow("conferência"));
  it("recusa código longo no domínio comercial antes de persistir", () => {
    expect(() => validarProduto({ codigo: "123456789" })).toThrow("8");
    expect(() => validarProduto({ codigo: "ABC-1" })).toThrow("letras");
  });
});
