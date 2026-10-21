import { describe, it, expect } from "vitest";
import { validarProduto, simularConfiguracao, type ProdutoEntrada } from "@/lib/vendas/dominio";
import { gerarFichaProduto } from "@/lib/vendas/ficha";
const base: ProdutoEntrada = { id: "", versao: 0, nome: "Teste", tipo: "PADRAO", classificacao: "PRINCIPAL", especificacao: null, descricao: null, codigo: null, unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: "Legado preservado", ativo: true, categorias: [], grupos: [], preco: "80", componentes: [] };
describe("novas regras comerciais", () => {
  it("mantém o preço único, inclusive base zero configurável", () => {
    expect(validarProduto({...base,preco:"10"}).preco).toBe("10");
    expect(validarProduto({...base,preco:"0"}).preco).toBe("0");
    expect(() => validarProduto({...base,componentes:[{insumoId:"i",unidade:"KG",quantidade:"1",exibirFicha:"não"}]})).toThrow();
    for (const preco of ["-1", "1.001", "1e3"]) expect(() => validarProduto({...base,preco})).toThrow();
  });
  it("exige tempo inteiro não negativo e classificação válida", () => {
    expect(validarProduto({ ...base,tempoPreparoMinutos:15 }).tempoPreparoMinutos).toBe(15);
    for (const tempo of [-1,0.5,NaN]) expect(() => validarProduto({ ...base,tempoPreparoMinutos:tempo })).toThrow();
    expect(() => validarProduto({ ...base,classificacao:"OUTRO" })).toThrow();
    expect(() => validarProduto({ ...base,classificacao:"COMPLEMENTO",grupos:[{grupoId:"g",usarPadrao:false,minimo:0,maximo:null}] })).toThrow("Somente Produtos");
  });
  const g = { id:"g",nome:"Queijos",tipo:"COMPOSICAO",minimo:9,maximo:9,repetir:false,ativo:true,opcoes:[{id:"a",nome:"Brie",preco:"10",ativo:true},{id:"b",nome:"Gouda",preco:"20",ativo:true}],vinculo:{grupoId:"g",usarPadrao:false,minimo:1,maximo:1,opcoesExcluidas:["b"]} };
  it("não aceita opção excluída nem soma seu preço", () => {
    expect(simularConfiguracao("80",[g],{a:1})).toMatchObject({valido:true,totalCentavos:9000});
    expect(simularConfiguracao("80",[g],{b:1})).toMatchObject({valido:false,totalCentavos:8000});
    expect(simularConfiguracao("80",[{...g,vinculo:{...g.vinculo,opcoesExcluidas:[],minimo:2,maximo:2}}],{a:1,b:1})).toMatchObject({valido:true,totalCentavos:11000});
  });
  it("ficha mostra tempo sem imprimir grupos ou alternativas comerciais", () => {
    const html = gerarFichaProduto({ ...base,tempoPreparoMinutos:12,grupos:[g.vinculo] },{insumos:[],categorias:[],grupos:[{...g,categoriaId:null,versao:1,tipo:"COMPOSICAO",produtos:[],opcoes:g.opcoes.map((o,ordem)=>({...o,grupoId:"g",produtoId:null,quantidade:"1",ordem}))}]});
    expect(html).toContain("12 minutos");
    expect(html).not.toContain("Grupos e alternativas");
    expect(html).not.toContain("Queijos");
    expect(html).not.toContain("Brie");
    expect(html).not.toContain("Gouda");
    expect(html).not.toContain("Modo de preparo");
  });
});
