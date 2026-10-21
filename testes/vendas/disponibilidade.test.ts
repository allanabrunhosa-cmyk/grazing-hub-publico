import { describe, expect, it } from "vitest";
import { classificacaoComercial } from "@/lib/vendas/classificacao";
import { validarCategoriaComercial, validarProduto, type ProdutoEntrada, type GrupoEntrada } from "@/lib/vendas/dominio";
import { disponibilidadeDoCadastro } from "@/lib/vendas/disponibilidade";
import { opcoesCatalogoPedido } from "@/lib/vendas/pedidos-catalogo";

const base: ProdutoEntrada = { id: "produto", nome: "Grazing sintética", versao: 1, classificacoes: ["PRINCIPAL"], tipo: "PADRAO", ativo: true, especificacao: null, descricao: null, codigo: null, unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: null, preco: "100", categorias: [], componentes: [], grupos: [{ grupoId: "grupo", usarPadrao: false, minimo: 0, maximo: 2 }] };
const complemento: ProdutoEntrada = { ...base, id: "copa", nome: "Copa sintética", classificacoes: ["COMPLEMENTO"], grupos: [] };
const grupo: GrupoEntrada = { id: "grupo", versao: 1, nome: "Montagem", tipo: "COMPOSICAO", ativo: true, minimo: 0, maximo: 2, repetir: true, opcoes: [{ id: "escolha", nome: "Copa", preco: "10", produtoId: "copa", quantidade: "1", ativo: true }] };
describe("organização e disponibilidade comercial", () => {
  it("aceita somente Produto ou Complemento e lê papéis antigos sem regravar", () => {
    expect(validarProduto(base).classificacoes).toEqual(["PRINCIPAL"]);
    expect(validarProduto(complemento).classificacoes).toEqual(["COMPLEMENTO"]);
    for (const classificacoes of [["OPCAO"], ["PRINCIPAL", "COMPLEMENTO"], []]) expect(() => validarProduto({ ...base, classificacoes })).toThrow("classificação");
    expect(classificacaoComercial({ classificacoes: ["OPCAO"] })).toBe("COMPLEMENTO");
    expect(classificacaoComercial({ classificacoes: ["PRINCIPAL", "COMPLEMENTO"] })).toBe("PRINCIPAL");
    expect(opcoesCatalogoPedido([base, complemento, { ...complemento, id: "legado", classificacoes: ["OPCAO"] }]).map(o => o.produtoId)).toEqual(["produto"]);
  });
  it("valida escopo, cor e os limites das categorias", () => {
    const categoria = { id: "", versao: 0, nome: "Charcutaria", ativo: true, escopo: "COMPLEMENTO", cor: "verde" };
    expect(validarCategoriaComercial(categoria)).toMatchObject({ escopo: "COMPLEMENTO", cor: "verde" });
    for (const invalido of [{ cor: "#ffffff" }, { escopo: "GRUPO" }, { nome: "x".repeat(121) }]) expect(() => validarCategoriaComercial({ ...categoria, ...invalido })).toThrow();
  });
  it("lista grupo, produto e origem da composição sem perder vínculos pausados", () => {
    const local = { ...base, grupos: [{ ...base.grupos[0], ajustesOpcoes: [{ opcaoId: "escolha", composicao: [] }] }] };
    expect(disponibilidadeDoCadastro("copa", [local, complemento], [grupo])).toMatchObject([{ grupoNome: "Montagem", produtoNome: "Grazing sintética", motivo: "Disponível", composicao: "Específica deste produto" }]);
    expect(disponibilidadeDoCadastro("copa", [{ ...base, grupos: [{ ...base.grupos[0], opcoesExcluidas: ["escolha"] }] }, complemento], [grupo])[0].motivo).toBe("Indisponível neste produto");
    expect(disponibilidadeDoCadastro("copa", [base, complemento], [{ ...grupo, ativo: false }])[0].motivo).toBe("Grupo inativo");
    expect(disponibilidadeDoCadastro("copa", [complemento], [grupo])[0].produtoNome).toBe("Sem produto vinculado");
  });
  it("respeita o alias inativo com composição própria aceito pelo servidor", () => {
    const produtos = [base, { ...complemento, ativo: false }];
    const composicao = [{ insumoId: "copa", quantidade: "0.05", unidade: "KG" }];
    const g = { ...grupo, opcoes: [{ ...grupo.opcoes[0], composicao }] };
    expect(disponibilidadeDoCadastro("copa", produtos, [g])[0].motivo).toBe("Disponível");
    expect(disponibilidadeDoCadastro("copa", produtos, [{ ...g, tipo: "COMPLEMENTAR" }])[0].motivo).toBe("Cadastro inativo");
    expect(disponibilidadeDoCadastro("copa", produtos, [{ ...g, opcoes: [{ ...g.opcoes[0], composicao: [] }] }])[0].motivo).toBe("Cadastro inativo");
  });
});
