import { describe, expect, it, vi } from "vitest";
import { lancamentoTeste } from "../dados-movimentacoes";
import { projetarCaixaFatura } from "@/lib/financeiro/faturas/projecoes";
import { calcularPlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { montarLinhasExtrato } from "@/lib/financeiro/extrato";
import { calcularDre } from "@/lib/financeiro/calcularDre";
vi.mock("server-only",()=>({}));
const banco=vi.hoisted(()=>({faturas:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{faturaCartao:{findMany:banco.faturas}}}));
import { projetarRelatorioFaturas } from "@/lib/financeiro/faturas/relatorios";
const data=new Date("2026-09-20T12:00:00Z");
const linha=lancamentoTeste({id:"despesa",valor:300,dataVencimento:data.toISOString()});
const pagamento={id:"p",data,valor:100,movimentoId:"movimento",contaIdOriginal:"banco",revertidoEm:null};
function fatura(completa:boolean){return {id:"f",estado:completa?"PARCIAL":"REVISAO",cartao:{nome:"Cartão fictício"},totalInformado:300,
  itens:[{lancamentos:[{id:linha.id,valor:300,liquidacoesCartao:completa?[{id:"q",valor:100,pagamento}]:[]}]}],pagamentos:[{...pagamento,liquidacoes:completa?[{id:"q"}]:[]}]};}
describe("projeções de cartão sem segunda despesa",()=>{
 it("DRE competência integral e caixa somente parcelas efetivamente pagas",()=>{
  const l={...linha,liquidacoesCartao:[{valor:100,data:data.toISOString()},{valor:200,data:"2026-10-20T12:00:00Z"}]};
  const periodo={de:new Date("2026-09-01"),ate:new Date("2026-09-30T23:59:59Z")};
  l.dataCompetencia=data.toISOString();
  expect(calcularDre([l],periodo,"COMPETENCIA").grupos[l.categoriaGrupo].total).toBe(300);
  expect(calcularDre([l],periodo,"CAIXA").grupos[l.categoriaGrupo].total).toBe(100);
 });
 it("preserva lançamentos de fora das faturas",()=>expect(projetarCaixaFatura(linha,null)).toEqual([linha]));
 it.each([true,false])("caixa parcial uma vez, classificação completa=%s",async completa=>{
  banco.faturas.mockResolvedValue([fatura(completa)]);
  const p=await projetarRelatorioFaturas([linha]);
  expect(p.movimentosSubstituidos.has("movimento")).toBe(true);
  expect(p.linhas.filter(l=>l.status==="BAIXADO").reduce((s,l)=>s+l.valor,0)).toBe(100);
  expect(p.linhas.filter(l=>l.status==="PENDENTE").reduce((s,l)=>s+l.valor,0)).toBe(200);
  expect(montarLinhasExtrato(p.linhas,[]).reduce((s,l)=>s+l.valor,0)).toBe(-300);
  const fluxo=calcularPlanilhaFluxoCaixa(1000,p.linhas,{de:"2026-09-01",ate:"2026-09-30"});
  expect(fluxo.saldoFinal).toBe(700);
  if(!completa)expect(fluxo.despesas.some(g=>g.grupo==="NAO_CLASSIFICADO")).toBe(true);
 });
 it("pagamento sem nenhuma despesa ainda aparece no caixa, não no DRE",async()=>{
  banco.faturas.mockResolvedValue([{...fatura(false),itens:[]}]);const p=await projetarRelatorioFaturas([]);
  expect(p.linhas).toHaveLength(1);expect(p.linhas[0]).toMatchObject({valor:100,semClassificacao:true,status:"BAIXADO"});
 });
 it("pagamento total sem classificação não deixa previsão duplicada",async()=>{
  const f=fatura(false);f.pagamentos[0].valor=300;banco.faturas.mockResolvedValue([f]);const p=await projetarRelatorioFaturas([linha]);
  expect(p.linhas).toHaveLength(1);expect(p.linhas[0].valor).toBe(300);
 });
 it("pagamento revertido não aparece nas liquidações",()=>{
  expect(projetarCaixaFatura(linha,{faturaId:"f",cartao:"Teste",liquidacoes:[{id:"q",valor:100,pagamento:{id:"p",data:data.toISOString(),contaIdOriginal:"b",revertidoEm:data.toISOString()}}]})).toMatchObject([{valor:300,status:"PENDENTE"}]);
 });
});
import {projetarDreFatura} from "@/lib/financeiro/faturas/projecoes";
it.each([true,false])("receita de reembolso preserva sinal e desconta previsão, completa=%s",async completa=>{
 const receita=lancamentoTeste({id:"receita",tipo:"RECEITA",categoriaGrupo:"RECEITA_BRUTA",valor:20,dataCompetencia:data.toISOString(),dataVencimento:data.toISOString()});
 const despesa={...linha,valor:100,dataCompetencia:data.toISOString()};
 const p={...pagamento,valor:40};
 banco.faturas.mockResolvedValue([{id:"f",estado:completa?"PARCIAL":"REVISAO",cartao:{nome:"Cartão"},totalInformado:80,
  itens:[{lancamentos:[{id:despesa.id,tipo:"DESPESA",valor:100,liquidacoesCartao:completa?[{id:"d",valor:50,pagamento:p}]:[]},{id:receita.id,tipo:"RECEITA",valor:20,liquidacoesCartao:completa?[{id:"r",valor:10,pagamento:p}]:[]}]}],pagamentos:[{...p,liquidacoes:completa?[{id:"d"},{id:"r"}]:[]}]}]);
 const resultado=await projetarRelatorioFaturas([despesa,receita]);
 expect(resultado.linhas.filter(l=>l.status==="PENDENTE").reduce((s,l)=>s+(l.tipo==="RECEITA"?-1:1)*l.valor,0)).toBe(40);
 expect(resultado.linhas.filter(l=>l.status==="BAIXADO").reduce((s,l)=>s+(l.tipo==="RECEITA"?-1:1)*l.valor,0)).toBe(40);
 const r=projetarDreFatura(receita,[{id:"r",valor:10,pagamento:{id:p.id,data:data.toISOString(),contaIdOriginal:"banco",revertidoEm:null}}]);
 const periodo={de:new Date("2026-09-01"),ate:new Date("2026-09-30T23:59:59Z")};
 expect(calcularDre([r],periodo,"CAIXA").grupos.RECEITA_BRUTA.total).toBe(10);
 expect(calcularDre([r],periodo,"COMPETENCIA").grupos.RECEITA_BRUTA.total).toBe(20);
});
