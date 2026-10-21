import {describe,it,expect} from "vitest";
import {dataIso,dinheiro,decimal,normalizarEstabelecimento,identificarLinhas,chaveParcelamento,ratearLiquidacao,resumoFatura,selecionarRegra,pontuarCorrespondencia,sugerirVinculosFatura,tipoDaLinha,parecePagamentoCartao,type LinhaFatura} from "@/lib/financeiro/faturas/dominio";
import {lerTabelaFatura,lerTextoPdf,extrairArquivo} from "@/lib/financeiro/faturas/arquivo";
const linha:LinhaFatura={linha:2,textoOriginal:"original",descricao:"APPLE 01/03",estabelecimento:"APPLE",data:"2026-09-01",valor:100000,parcela:1,totalParcelas:3,tipo:"COMPRA",revisar:false,moeda:"BRL"};
describe("faturas: domínio monetário e importação",()=>{
 it("preserva centavos e sinal sem float intermediário",()=>{for(const v of ["0.01","999999999999.99","-1.01","12.30"])expect(decimal(dinheiro(v))).toBe(v);expect(()=>dinheiro("1.001")).toThrow();});
 it("não aceita datas inexistentes",()=>{expect(()=>dataIso("2026-02-30")).toThrow();expect(dataIso("2024-02-29")).toBe("2024-02-29");});
 it("normaliza mantendo a identidade do restaurante",()=>{expect(normalizarEstabelecimento("MERCADOLIVRE*ABC123")).toBe("MERCADO LIVRE");expect(normalizarEstabelecimento("GOOGLE*GSUITE")).toBe("GOOGLE WORKSPACE");expect(normalizarEstabelecimento("IFOOD*RESTAURANTEABC")).toBe("IFOOD / RESTAURANTEABC");});
 it("itens repetidos legítimos conservam identidade por ocorrência",()=>{const l=identificarLinhas([linha,{...linha,linha:3}]);expect(l[0].identidade).not.toBe(l[1].identidade);expect(l[1].possivelDuplicada).toBe(true);expect(identificarLinhas([linha])[0].identidade).toBe(l[0].identidade);});
 it("segunda parcela vincula à mesma âncora no mês seguinte",()=>{expect(chaveParcelamento(linha,"2026-09")).toBe(chaveParcelamento({...linha,descricao:"APPLE 02/03",parcela:2},"2026-10"));});
 it("não mistura duas compras de valores diferentes",()=>expect(chaveParcelamento(linha,"2026-09")).not.toBe(chaveParcelamento({...linha,valor:90000},"2026-09")));
 it.each([["JUROS ROTATIVO",100,"JUROS"],["IOF",1,"IOF"],["TARIFA",10,"TARIFA"],["MULTA",2,"MULTA"],["ESTORNO AMAZON",-500,"ESTORNO"],["CASHBACK",-10,"CREDITO"]])("distingue %s",(d,v,t)=>expect(tipoDaLinha(String(d),Number(v))).toBe(t));
 it("pagamento parcial rateia despesa e crédito sem criar receita",()=>expect(ratearLiquidacao([90000,-10000],40000)).toEqual([45000,-5000]));
 it("dois pagamentos fecham exatamente com as despesas",()=>{const a=ratearLiquidacao([101,101,-2],67),b=ratearLiquidacao([101,101,-2],200);expect(a.reduce((s,v)=>s+v,0)).toBe(67);expect(b).toEqual([101,101,-2]);expect(b.map((v,i)=>v-a[i]).reduce((s,v)=>s+v,0)).toBe(133);});
 it("rateio mantém precisão para limites monetários elevados",()=>{const valores=[99999999999990,-1234,5000];const r=ratearLiquidacao(valores,99999999900000);expect(r.reduce((s,v)=>s+v,0)).toBe(99999999900000);});
 it("recusa pagamento superior e base líquida negativa",()=>{expect(()=>ratearLiquidacao([100],101)).toThrow();expect(()=>ratearLiquidacao([-100],10)).toThrow();});
 it("diferencia paga não desdobrada, parcial e divergência",()=>{const i=[{valor:100,vinculado:false,revisado:false,ignorado:false}];expect(resumoFatura(100,i,100)).toMatchObject({estado:"REVISAO",pendente:0,pendencias:1});expect(resumoFatura(101,i,0).estado).toBe("DIVERGENTE");expect(resumoFatura(100,[{...i[0],vinculado:true,revisado:true}],50).estado).toBe("PARCIAL");});
 it("regra explícita exata vence heurística de maior prioridade",()=>{const base={cartaoId:null,tipo:null,valorMinimo:null,valorMaximo:null,origem:"EXPLICITA"};expect(selecionarRegra([{...base,id:"1",texto:"GOOGLE",modo:"CONTEM",prioridade:100},{...base,id:"2",texto:"GOOGLE WORKSPACE",modo:"EXATO",prioridade:0}],{descricao:"GOOGLE*GSUITE",cartaoId:"c",tipo:"COMPRA",valor:50})?.id).toBe("2");});
 it("desconhecido não ganha categoria inventada",()=>expect(selecionarRegra([],{descricao:"ABC",cartaoId:"c",tipo:"COMPRA",valor:10})).toBeNull());
 it("matching exige valor exato e cartão compatível",()=>{const i={valor:100,data:"2026-09-01",descricao:"ABC",cartaoId:"c"},c={...i,id:"l",fornecedorId:null};expect(pontuarCorrespondencia(i,c,5)?.forte).toBe(true);expect(pontuarCorrespondencia(i,{...c,valor:101},5)).toBeNull();expect(pontuarCorrespondencia(i,{...c,cartaoId:"outro"},5)).toBeNull();});
 it("detecta pagamento de fatura para bloquear despesa genérica",()=>{expect(parecePagamentoCartao("PGTO FATURA ITAU VISA")).toBe(true);expect(parecePagamentoCartao("COMPRA APPLE")).toBe(false);});
 it("lê tabela com várias despesas e preserva texto original",()=>{const r=lerTabelaFatura([["Data","Descrição","Valor"],["01/09/2026","MERCADOLIVRE*ABC","1.234,56"],["02/09/2026","ESTORNO AMAZON","-50,00"]]);expect(r.linhas.map(l=>l.valor)).toEqual([123456,-5000]);expect(r.linhas[0].textoOriginal).toContain("MERCADOLIVRE*ABC");});
 it("colunas inesperadas exigem mapeamento",()=>expect(()=>lerTabelaFatura([["X","Y","Z"],["a","b","c"]])).toThrow("Colunas"));
 it("linha malformada não é descartada silenciosamente",()=>{const r=lerTabelaFatura([["Data","Descrição","Valor"],["01/09/2026","X","1,234"]]);expect(r.linhas).toHaveLength(0);expect(r.naoReconhecidas).toHaveLength(1);});
 it("PDF sem ano não inventa data",()=>{const r=lerTextoPdf("01/09 APPLE 50,00\n02/09/2026 GOOGLE 100,00");expect(r.linhas).toHaveLength(1);expect(r.linhas[0].revisar).toBe(true);expect(r.naoReconhecidas).toHaveLength(1);});
 it("PDF inválido é recusado",async()=>await expect(extrairArquivo(Buffer.from("não é pdf"),"fatura.pdf")).rejects.toThrow("PDF inválido"));
 it("CSV malformado é recusado",async()=>await expect(extrairArquivo(Buffer.from('Data,Descrição,Valor\n"sem fechar'),"fatura.csv")).rejects.toThrow("CSV malformado"));
});

it("sugere mesmo nome, valor e vencimento mesmo com competência diferente",()=>{const i={valor:10000,data:"2026-09-01",vencimento:"2026-09-20",descricao:"Compra",cartaoId:"c"};const c={id:"l",valor:10000,data:"2025-01-01",vencimento:"2026-09-20",descricao:"COMPRA",cartaoId:null,fornecedorId:null};expect(pontuarCorrespondencia(i,c,5)).toMatchObject({forte:true,motivos:expect.arrayContaining(["Mesmo vencimento","Descrição exata"])});expect(pontuarCorrespondencia(i,{...c,valor:10001},5)).toBeNull();});

it("sugere um lançamento apenas quando nome, valor e vencimento coincidem",()=>{const item={descricao:"Compra",valor:10000,vencimento:"2026-09-20"};const base={id:"a",descricao:"COMPRA",valor:10000,vencimento:"2026-09-20",notaGrupo:null};expect(sugerirVinculosFatura(item,[base])).toMatchObject([{ids:["a"]}]);expect(sugerirVinculosFatura(item,[{...base,descricao:"Outro"}])).toEqual([]);expect(sugerirVinculosFatura(item,[{...base,vencimento:"2026-09-21"}])).toEqual([]);});
it("sugere soma de duas despesas com mesmo nome e vencimento",()=>{expect(sugerirVinculosFatura({descricao:"Compra",valor:10000,vencimento:"2026-09-20"},[{id:"a",descricao:"COMPRA",valor:4000,vencimento:"2026-09-20",notaGrupo:null},{id:"b",descricao:"Compra",valor:6000,vencimento:"2026-09-20",notaGrupo:null}])).toMatchObject([{ids:["a","b"],valor:10000}]);});
it("sugere soma de nota apenas com mesmo cartão e data de compra próxima",()=>{
 const item={descricao:"Compra no cartão",valor:10000,vencimento:"2026-09-20",cartaoId:"cartao",data:"2026-07-06",toleranciaDias:5};
 const base=[{id:"a",descricao:"Produto A",valor:4000,vencimento:item.vencimento,notaGrupo:"nota",cartaoId:"cartao",data:item.data},{id:"b",descricao:"Produto B",valor:6000,vencimento:item.vencimento,notaGrupo:"nota",cartaoId:"cartao",data:item.data}];
 expect(sugerirVinculosFatura(item,base)).toMatchObject([{ids:["a","b"]}]);
 expect(sugerirVinculosFatura(item,base.map(c=>({...c,cartaoId:null})))).toEqual([]);
 expect(sugerirVinculosFatura(item,base.map(c=>({...c,data:"2026-09-18"})))).toEqual([]);
});

it.each(["0001-01-01", "0206-10-10", "1900-01-01", "1999-12-31", "2026-13-01"])("não aceita ano anterior a 2000 ou data inexistente em fatura: %s", data => {
  expect(() => dataIso(data)).toThrow("Data inválida");
});
it("aceita 2000 como ano bissexto no limite inferior das faturas", () => expect(dataIso("2000-02-29")).toBe("2000-02-29"));
