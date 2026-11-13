import { describe, expect, it } from "vitest";
import { tituloEntradaAvulsa } from "@/lib/inventario/entrada-avulsa-titulo";
import { descricaoTituloEntradaAvulsa } from "@/lib/financeiro/titulo-entrada-avulsa";

const compra = {
  fornecedor: { nome: "Fornecedor fictício" }, registro: null,
  movimentacoes: [{ insumo: { nome: "Queijo" } }, { insumo: { nome: "Presunto" } }],
};
describe("título financeiro de entrada avulsa", () => {
  it("mostra fornecedor e todos os produtos sem repetir produtos em locais diferentes", () => {
    expect(tituloEntradaAvulsa("  Fornecedor   fictício ", ["Queijo", "Presunto", " queijo "])).toBe("FORNECEDOR FICTÍCIO — QUEIJO, PRESUNTO");
  });
  it("aceita um produto e nomes longos sem abreviar o conteúdo", () => {
    const nome = "Embalagem para cesta de café da manhã e eventos corporativos";
    expect(tituloEntradaAvulsa("Fornecedor fictício", [nome])).toBe(`FORNECEDOR FICTÍCIO — ${nome.toLocaleUpperCase("pt-BR")}`);
  });
  it("reconstrói a descrição antiga pela compra sem alterar a fonte", () => {
    const titulo = { descricao: "COMPRA SEM NOTA — FORNECEDOR FICTÍCIO", origemEntradaAvulsaCompra: compra };
    const antes = structuredClone(titulo);
    expect(descricaoTituloEntradaAvulsa(titulo)).toBe("FORNECEDOR FICTÍCIO — QUEIJO, PRESUNTO");
    expect(titulo).toEqual(antes);
  });
  it("usa a composição vigente após uma correção, sem ressuscitar produtos anteriores", () => {
    expect(descricaoTituloEntradaAvulsa({ descricao: "Título antigo", origemEntradaAvulsaCompra: { ...compra,
      registro: { snapshot: { itens: [{ nome: "Café" }, { nome: "Leite" }] } },
    } })).toBe("FORNECEDOR FICTÍCIO — CAFÉ, LEITE");
  });
  it.each([null, {}, { itens: [null, "texto", { nome: 7 }] }])("usa movimentos quando o legado não possui snapshot de itens (%j)", snapshot => {
    expect(descricaoTituloEntradaAvulsa({ descricao: "Título antigo", origemEntradaAvulsaCompra: { ...compra, registro: { snapshot } } })).toBe("FORNECEDOR FICTÍCIO — QUEIJO, PRESUNTO");
  });
  it("identifica a compra mesmo se somente o vínculo físico antigo estiver preenchido", () => {
    expect(descricaoTituloEntradaAvulsa({ descricao: "COMPRA SEM NOTA — ANTIGO", origemMovimentacaoEstoque: { tipo: "ENTRADA_COMPRA", insumo: { nome: "Queijo" }, entradaAvulsaCompra: compra } })).toBe("FORNECEDOR FICTÍCIO — QUEIJO, PRESUNTO");
  });
  it("identifica a entrada individual anterior ao cadastro de compras", () => {
    expect(descricaoTituloEntradaAvulsa({ descricao: "COMPRA SEM NOTA — FORNECEDOR FICTÍCIO", origemMovimentacaoEstoque: { tipo: "ENTRADA_COMPRA", insumo: { nome: "Queijo" }, entradaAvulsaCompra: null } })).toBe("FORNECEDOR FICTÍCIO — QUEIJO");
  });
  it("preserva a descrição de lançamentos que não vieram de entradas avulsas", () => {
    expect(descricaoTituloEntradaAvulsa({ descricao: "Aluguel da cozinha" })).toBe("Aluguel da cozinha");
    expect(descricaoTituloEntradaAvulsa({ descricao: "COMPRA SEM NOTA — descrição manual sem origem" })).toBe("COMPRA SEM NOTA — descrição manual sem origem");
  });
});
