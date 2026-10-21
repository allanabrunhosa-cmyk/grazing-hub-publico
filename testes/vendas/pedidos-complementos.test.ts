import { describe, expect, it } from "vitest";
import { opcoesCatalogoPedido, permiteOpcaoAvulsa, chaveItemCatalogoPedido } from "@/lib/vendas/pedidos-catalogo";
import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";
import type { GrupoEntrada, ProdutoEntrada } from "@/lib/vendas/dominio";

const grupo: GrupoEntrada = { id: "grupo", versao: 1, nome: "Extras", ativo: true, tipo: "COMPLEMENTAR", minimo: 1, maximo: 2, repetir: false, opcoes: [
  { id: "opcao", nome: "Porção fictícia", ativo: true, produtoId: "complemento", preco: "7.25", quantidade: "0.3" },
  { id: "sem-produto", nome: "Opção sem ficha", ativo: true, produtoId: null, preco: "4", quantidade: "1" },
] };
const vinculo = { grupoId: grupo.id, usarPadrao: false, minimo: 0, maximo: 2, opcoesExcluidas: [] as string[] };
const produto = { id: "principal", nome: "Kit", ativo: true, classificacoes: ["PRINCIPAL"], categorias: ["categoria"], grupos: [vinculo], preco: "30" } as ProdutoEntrada;
const complemento = { ...produto, id: "complemento", nome: "Produto da porção", classificacoes: ["COMPLEMENTO"], grupos: [], preco: "20" } as ProdutoEntrada;

describe("complementos como escolhas internas do pedido", () => {
  it("seleção de novos itens contém somente produtos vendáveis e independe do canal", () => {
    expect(opcoesCatalogoPedido([produto, complemento]).map(o => o.value)).toEqual(["principal"]);
    expect(opcoesCatalogoPedido([produto, complemento]).map(o => o.value)).toEqual(["principal"]);
    expect(opcoesCatalogoPedido([{ ...produto, ativo: false }, complemento])).toEqual([]);
  });
  it("preserva identificação de porções históricas sem oferecê-las como novos itens", () => {
    const item = { produtoId: complemento.id, complementoAvulso: { produtoOrigemId: produto.id, grupoId: grupo.id, opcaoId: "opcao" } };
    expect(chaveItemCatalogoPedido(item)).toBe("opcao:principal:grupo:opcao:complemento");
    expect(opcoesCatalogoPedido([produto, complemento]).some(o => o.complementoAvulso)).toBe(false);
    expect(chaveItemCatalogoPedido({ ...item, produtoId: "outro" })).not.toBe(chaveItemCatalogoPedido(item));
    expect(permiteOpcaoAvulsa(grupo, { ...vinculo, usarPadrao: true })).toBe(false);
  });
  it("mantém leitura do contrato legado sem aceitar preço forjado ou escolhas aninhadas", () => {
    const item = { produtoId: "complemento", quantidade: "2", escolhas: {}, precoManual: null };
    const complementoAvulso = { produtoOrigemId: "principal", grupoId: "grupo", opcaoId: "opcao" };
    expect(validarEntradaPedido({ itens: [{ ...item, complementoAvulso: { ...complementoAvulso, preco: "0.01" } }] }).itens[0].complementoAvulso).toEqual(complementoAvulso);
    expect(() => validarEntradaPedido({ itens: [{ ...item, complementoAvulso, escolhas: { outro: 1 } }] })).toThrow("não recebe outras escolhas");
  });
});
