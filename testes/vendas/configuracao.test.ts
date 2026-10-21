import { describe, it, expect } from "vitest";
import { resolverConfiguracao } from "@/lib/vendas/configuracao";
import { gerarFichaConfiguracao, gerarFichaProduto } from "@/lib/vendas/ficha";
import type { DadosProdutos } from "@/lib/vendas/consultas";

const base: DadosProdutos["produtos"][number] = { tipoEmbalagemId: null, slotsEntrega: null, id: "p", versao: 1, classificacao: "PRINCIPAL", classificacoes: ["PRINCIPAL"], tempoPreparoMinutos: 12, nome: "Produto teste", especificacao: null, descricao: null, tipo: "PERSONALIZADO", codigo: null, unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: null, ativo: true, fiscalRevisado: false, fiscal: {}, grupoFiscalId: null, categorias: [], grupos: [{ grupoId: "g", usarPadrao: true, opcoesExcluidas: [], minimo: 1, maximo: 1 }], preco: "0", componentes: [{ insumoId: "i", observacaoPorcao: null, quantidade: "0.1", unidade: "KG" }] };
const dados: DadosProdutos = { tiposEmbalagem: [], categorias: [], categoriasGrupos: [], gruposFiscais: [], insumos: [{ id: "i", tipo: "INSUMO", nome: "Queijo", categoriaNome: "Laticínios", especificacao: null, unidade: "KG", ativo: true, custo: 20 }], produtos: [base, { ...base, id: "porcao", nome: "Porção teste", tipo: "PADRAO", grupos: [], componentes: [{ insumoId: "i", observacaoPorcao: null, quantidade: "0.2", unidade: "KG" }] }], grupos: [{ id: "g", nome: "Quantidade", versao: 1, tipo: "COMPLEMENTAR", categoriaId: null, minimo: 1, maximo: 1, repetir: false, ativo: true, produtos: ["p"], opcoes: [{ id: "40", grupoId: "g", nome: "40 unidades", preco: "119", quantidade: "40", produtoId: "porcao", ativo: true, ordem: 0 }, { id: "80", grupoId: "g", nome: "80 unidades", preco: "209", quantidade: "80", produtoId: "porcao", ativo: true, ordem: 1 }] }] };
describe("configuração comercial e ficha resolvida", () => {
  it("aplica o preço único e preserva escolha grátis explícita no vínculo", () => {
    const d = structuredClone(dados);
    d.produtos[1].preco = "12";
    d.grupos[0].opcoes[0].usarPrecoPadrao = true;
    const p = { ...base, preco: "100" };
    expect(resolverConfiguracao(p, d, { "40": 1 }).totalCentavos).toBe(11200);
    expect(resolverConfiguracao(p, d, { "40": 1 }).totalCentavos).toBe(11200);
    expect(resolverConfiguracao({ ...p, grupos: [{ ...p.grupos[0], ajustesOpcoes: [{ opcaoId: "40", preco: "0" }] }] }, d, { "40": 1 }).totalCentavos).toBe(10000);
  });
  it("resolve composição direta sem depender de outro produto selecionado", () => {
    const d = structuredClone(dados);
    Object.assign(d.grupos[0].opcoes[0], { produtoId: null, composicao: [{ insumoId: "i", unidade: "KG", quantidade: "0.2" }] });
    expect(resolverConfiguracao(base, d, { "40": 1 })).toMatchObject({ custo: 6, componentes: [{ quantidade: "0.3" }], pendencias: [] });
  });
  it("resolve preço grátis e composição substituta sem multiplicar duas vezes ou alterar padrão", () => {
    const p = { ...base, preco: "100", grupos: [{ ...base.grupos[0], ajustesOpcoes: [{ opcaoId: "40", preco: "0", composicao: [{ insumoId: "i", unidade: "KG", quantidade: "0.2" }] }] }] };
    const r = resolverConfiguracao(p, dados, { "40": 1 });
    expect(r).toMatchObject({ valido: true, totalCentavos: 10000, custo: 6, componentes: [{ quantidade: "0.3" }] });
    expect(dados.produtos[1].componentes[0].quantidade).toBe("0.2");
    expect(dados.grupos[0].opcoes[0].preco).toBe("119");
  });
  it.each(["PADRAO", "PERSONALIZADO"] as const)("ficha %s mantém informações de produção sem anexo de escolhas", tipo => {
    const produto = { ...base, tipo, fotoUrl: "/api/vendas/fotos/referencia", observacoes: "Conferir a montagem.", componentes: [{ ...base.componentes[0], observacaoPorcao: "2 fatias" }] };
    const html = gerarFichaProduto(produto, dados);
    expect(html).not.toContain("Grupos e alternativas");
    expect(html).not.toContain("Quantidade</h2>");
    expect(html).not.toContain("40 unidades");
    expect(html).not.toContain("80 unidades");
    expect(html).not.toContain('class="anexo"');
    expect(html).not.toContain("break-before:page");
    for (const texto of ["Queijo", "Laticínios", "2 fatias", "0,1 KG", "12 minutos", "Conferir a montagem.", "/api/vendas/fotos/referencia"]) expect(html).toContain(texto);
    expect(produto.grupos).toEqual(base.grupos);
  });
  it("a ficha mestre respeita a ordem e não imprime embalagens ocultas", () => {
    const ingredientes = [{...dados.insumos[0],id:"a",nome:"Primeiro"},{...dados.insumos[0],id:"b",nome:"Segundo"},{...dados.insumos[0],id:"s",nome:"Saco oculto"}];
    const p = {...base,grupos:[],componentes:[{insumoId:"b",quantidade:"1",unidade:"KG"},{insumoId:"s",quantidade:"1",unidade:"KG",exibirFicha:false},{insumoId:"a",quantidade:"1",unidade:"KG"}]};
    const html = gerarFichaProduto(p,{...dados,insumos:ingredientes});
    expect(html).not.toContain("Saco oculto");
    expect(html.indexOf("Segundo")).toBeLessThan(html.indexOf("Primeiro"));
    expect(gerarFichaProduto({...p,componentes:p.componentes.map(c=>({...c,exibirFicha:false}))},{...dados,insumos:ingredientes})).toContain("Nenhum ingrediente marcado para montagem.");
  });
  it("omite itens só de estoque na ficha, incluindo mistura do mesmo insumo em escolhas", () => {
    const d = structuredClone(dados);
    d.produtos[1].componentes[0].exibirFicha = false;
    const r = resolverConfiguracao(base,d,{"40":1});
    expect(r.custo).toBe(162);
    expect(r.componentes).toHaveLength(2);
    expect(r.componentes.reduce((s,c)=>s+Number(c.quantidade),0)).toBeCloseTo(8.1);
    const html = gerarFichaConfiguracao(base,d,{"40":1});
    expect(html).toContain("0,1 KG");
    expect(html).not.toContain("8 KG");
  });
  it("destaca porções escaladas e preserva categoria na ficha", () => {
    const d = structuredClone(dados);
    d.produtos[1].componentes[0].observacaoPorcao = "2 fatias";
    const p = { ...base, componentes: [{ ...base.componentes[0], observacaoPorcao: "1 fatia" }] };
    const r = resolverConfiguracao(p, d, { "40": 1 });
    expect(r.componentes[0].observacaoPorcao).toBe("1 fatia + 40 × (2 fatias)");
    const html = gerarFichaConfiguracao(p, d, { "40": 1 });
    expect(html).toContain("Laticínios");
    expect(html).toContain("1 fatia + 40 × (2 fatias)");
    expect(html.indexOf("Porção de montagem")).toBeLessThan(html.indexOf("Qtd. estoque"));
  });
  it("usa o preço consolidado e não resolve a composição de opção excluída", () => {
    const p = {...base,preco: "80",grupos:[{...base.grupos[0],opcoesExcluidas:["80"]}]};
    expect(resolverConfiguracao(p,dados,{"40":1}).totalCentavos).toBe(19900);
    const r=resolverConfiguracao(p,dados,{"80":1});expect(r.valido).toBe(false);expect(r.selecionadas).toEqual([]);expect(r.componentes[0].quantidade).toBe("0.1");
  });
  it("base zero exige escolha e 40/80 calculam preços e composição distintos", () => {
    expect(resolverConfiguracao(base, dados, {}).valido).toBe(false);
    const a = resolverConfiguracao(base, dados, { "40": 1 });
    const b = resolverConfiguracao(base, dados, { "80": 1 });
    expect(a).toMatchObject({ valido: true, totalCentavos: 11900, custo: 162, componentes: [{ quantidade: "8.1" }] });
    expect(b).toMatchObject({ valido: true, totalCentavos: 20900, custo: 322, componentes: [{ quantidade: "16.1" }] });
    expect(resolverConfiguracao(base, dados, { "40": 1, "80": 1 }).valido).toBe(false);
  });
  it("mantém precisão das quantidades fracionadas ao somar composições", () => {
    const d = structuredClone(dados); d.grupos[0].opcoes[0].quantidade = "0.000000000000000001";
    expect(resolverConfiguracao(base, d, { "40": 1 }).componentes[0].quantidade).toBe("0.1000000000000000002");
  });
  it("não calcula custo zero quando falta vínculo/composição", () => {
    const d = structuredClone(dados); d.grupos[0].opcoes[0].produtoId = null;
    const r = resolverConfiguracao(base, d, { "40": 1 });
    expect(r.valido).toBe(true); expect(r.custo).toBeNull(); expect(r.pendencias[0]).toContain("composição");
    expect(resolverConfiguracao({ ...base, componentes: [], grupos: [] }, dados, {}).custo).toBeNull();
  });
  it("não ignora grupo obrigatório inativo, referência ausente ", () => {
    const d = structuredClone(dados); d.grupos[0].ativo = false;
    expect(resolverConfiguracao(base, d, {}).erros.join()).toContain("obrigatório inativo");
    expect(resolverConfiguracao(base, { ...dados, grupos: [] }, {}).valido).toBe(false);
    expect(resolverConfiguracao(base, dados, { "40": 1 }).valido).toBe(true);
  });
  it("ficha mostra somente escolhas válidas, texto escapado e sem ordem de produção", () => {
    expect(() => gerarFichaConfiguracao(base, dados, {})).toThrow("configuração válida");
    const html = gerarFichaConfiguracao(base, dados, { "40": 1 });
    expect(html).toContain("40 unidades"); expect(html).not.toContain("80 unidades");
    expect(html).toContain("8,1 KG"); expect(html).toContain("não vinculada a pedido");
    expect(html).not.toContain("Grupos e alternativas");
    const d = structuredClone(dados); d.grupos[0].opcoes[0].nome = "<script>alert(1)</script>";
    expect(gerarFichaConfiguracao(base, d, { "40": 1 })).toContain("&lt;script&gt;");
  });
});
