import { describe, expect, it } from "vitest";
import { ordenarItensContagem, type OrdenacaoContagem } from "@/app/(protegido)/inventario/contagem/ordenacao";
import { gerarHtmlContagem } from "@/app/(protegido)/inventario/contagem/impressao";
import { contagemTeste, itensContagemTeste } from "./dados";

describe("Ordenação da contagem", () => {
  it.each<[OrdenacaoContagem["coluna"], string[]]>([
    ["nome", ["acucar", "pao", "queijo", "uva"]],
    ["fornecedores", ["acucar", "queijo", "pao", "uva"]],
    ["tipoEstoque", ["acucar", "pao", "queijo", "uva"]],
    ["unidade", ["acucar", "queijo", "uva", "pao"]],
    ["quantidadeContada", ["acucar", "queijo", "pao", "uva"]],
    ["quantidadeSistema", ["acucar", "uva", "queijo", "pao"]],
    ["diferenca", ["queijo", "acucar", "pao", "uva"]],
    ["ajustado", ["pao", "queijo", "uva", "acucar"]],
  ])("ordena a coluna %s pelo valor apresentado", (coluna, ids) => {
    expect(ordenarItensContagem(itensContagemTeste, { coluna, direcao: "asc" }).map((item) => item.id)).toEqual(ids);
  });

  it("inverte a direção, mantém ausentes no final e não altera a lista original", () => {
    const original = itensContagemTeste.map((item) => item.id);
    expect(ordenarItensContagem(itensContagemTeste, { coluna: "quantidadeContada", direcao: "desc" }).map((item) => item.id)).toEqual(["queijo", "acucar", "pao", "uva"]);
    expect(itensContagemTeste.map((item) => item.id)).toEqual(original);
  });
});

describe("Folha de contagem manual", () => {
  it("imprime a folha em A4 retrato", () => {
    const html = gerarHtmlContagem(contagemTeste, itensContagemTeste, "");
    expect(html).toContain("@page { size: A4 portrait;");
    expect(html).not.toContain("A4 landscape");
  });

  it("mostra limites cadastrados, inclusive máximo ausente, sem preencher a contagem", () => {
    const html = gerarHtmlContagem(contagemTeste, itensContagemTeste.slice(0, 2), "");
    expect(html).toContain("<th>Est. mín.</th><th>Est. máx.</th><th>Qtd. contada</th>");
    expect(html).toMatch(/Queijo brie[\s\S]*?<td>3,5<\/td>\s*<td>25<\/td>\s*<td class="contagem"><\/td>/);
    expect(html).toMatch(/Açúcar[\s\S]*?<td>5<\/td>\s*<td>—<\/td>\s*<td class="contagem"><\/td>/);
  });

  it("mostra a especificação de insumos e preparações abaixo do nome, escapando HTML", () => {
    const itens = [
      { ...itensContagemTeste[0], especificacao: 'Leite <integral> "A"' },
      { ...itensContagemTeste[2], especificacao: "Receita refrigerada" },
    ];
    const html = gerarHtmlContagem(contagemTeste, itens, "");
    expect(html).toContain('Queijo brie<br><span class="especificacao">Leite &lt;integral&gt; &quot;A&quot;</span>');
    expect(html).toContain('Pão artesanal<br><span class="especificacao">Receita refrigerada</span>');
    expect(html).not.toContain("<integral>");
  });

  it("respeita a lista filtrada sem preencher quantidades", () => {
    const ordenacao: OrdenacaoContagem = { coluna: "nome", direcao: "desc" };
    const itens = ordenarItensContagem(itensContagemTeste.slice(0, 2), ordenacao);
    const html = gerarHtmlContagem(contagemTeste, itens, "");
    expect(html).not.toContain("Pão artesanal");
    expect(html).toContain("2 de 4");
    expect(html).toContain('class="contagem"></td>');
    expect(html).not.toMatch(/<td[^>]*>\s*(12|19|2|1)\s*<\/td>/);
    expect(html).not.toContain("<th>Sistema</th>");
    expect(html).toContain("Laticínios Serra, Queijaria Central");
  });

  it("ordena somente a folha por tipo, fornecedor e nome, sem alterar os itens recebidos", () => {
    const base = itensContagemTeste[0];
    const itens = [
      { ...base, id: "z", nome: "Zebra", tipoEstoque: "SECO" as const, fornecedores: ["Alfa"] },
      { ...base, id: "b", nome: "Banana", tipoEstoque: "SECO" as const, fornecedores: ["Alfa"] },
      { ...base, id: "a", nome: "Açúcar", tipoEstoque: "SECO" as const, fornecedores: ["Beta"] },
      { ...base, id: "f", nome: "Frio", tipoEstoque: "REFRIGERADO" as const, fornecedores: ["Zeta"] },
      { ...base, id: "s", nome: "Sem fornecedor", tipoEstoque: "SECO" as const, fornecedores: [] },
      { ...base, id: "t", nome: "Sem tipo", tipoEstoque: null, fornecedores: ["Alfa"] },
    ];
    const html = gerarHtmlContagem(contagemTeste, itens, "");
    const nomes = ["Banana", "Zebra", "Açúcar", "Sem fornecedor", "Frio", "Sem tipo"];
    expect(nomes.map((nome) => html.indexOf(`<td>${nome}`))).toEqual([...nomes.map((nome) => html.indexOf(`<td>${nome}`))].sort((a, b) => a - b));
    expect(itens.map((item) => item.id)).toEqual(["z", "b", "a", "f", "s", "t"]);
    expect(html).toContain("Tipo de estoque, fornecedor e insumo (A–Z)");
  });

  it("escapa os dados cadastrados e os filtros antes de escrever o HTML", () => {
    const malicioso = '<script>alert("teste")</script>';
    const html = gerarHtmlContagem({ ...contagemTeste, localNome: malicioso }, [{ ...itensContagemTeste[0], nome: malicioso, fornecedores: [malicioso] }], malicioso);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
