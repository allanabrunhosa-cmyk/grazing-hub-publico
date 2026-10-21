import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { corpoNegociacaoIfood, lerNegociacaoIfood } from "@/lib/ifood/negociacao";
import { confirmacaoAcaoIfood } from "@/lib/ifood/confirmacao-acao";
import { adaptarPedido } from "@/lib/ifood/adaptador";
import { obrigacoesFinanceirasIfood } from "@/lib/ifood/financeiro";
import { merchant, pedidoRemoto } from "./fixtures";
const alternativaId = "66666666-6666-4666-8666-666666666666";
const disputa = { action:"PARTIAL_CANCELLATION",handshakeType:"AFTER_DELIVERY_PARTIALLY",metadata:{items:[{id:"produto",uniqueId:"linha",quantity:1,index:0,amount:{value:"2220",currency:"BRL"},reason:"ITEM_MISSING"}]},alternatives:[{id:alternativaId,type:"REFUND",metadata:{maxAmount:{value:"2220",currency:"BRL"}}}] };
describe("Negociação e composição financeira iFood",()=>{
  it("mostra cancelamento parcial sem convertê-lo em cancelamento total",()=>{
    const n=lerNegociacaoIfood(disputa); expect(n.compativel).toBe(true); expect(n.itens[0].valor).toBe("22.20"); expect(n.alternativas[0].maximo).toBe("22.20");
    expect(lerNegociacaoIfood({...disputa,metadata:{}}).compativel).toBe(false);
  });
  it("exige o motivo oficial no aceite e limita o detalhe",()=>{
    const d={...disputa,metadata:{...disputa.metadata,acceptCancellationReasons:["PRODUCT_QUALITY"]}};
    expect(()=>corpoNegociacaoIfood(d,"acceptDispute",{})).toThrow(/motivo/);
    expect(corpoNegociacaoIfood(d,"acceptDispute",{codigo:"PRODUCT_QUALITY",motivo:"Conferido"})).toEqual({reason:"PRODUCT_QUALITY",detailReason:"Conferido"});
    expect(()=>corpoNegociacaoIfood(d,"acceptDispute",{codigo:"PRODUCT_QUALITY",motivo:"x".repeat(251)})).toThrow(/250/);
  });
  it("converte reais para centavos uma vez e rejeita valor excessivo, moeda desconhecida e alternativa inexistente",()=>{
    expect(corpoNegociacaoIfood(disputa,"alternativeDispute",{alternativaId,valor:"12,34"})).toEqual({type:"REFUND",metadata:{amount:{value:"1234",currency:"BRL"}}});
    expect(()=>corpoNegociacaoIfood(disputa,"alternativeDispute",{alternativaId,valor:"22.21"})).toThrow(/limite/);
    expect(()=>corpoNegociacaoIfood(disputa,"alternativeDispute",{alternativaId,valor:"12.345"})).toThrow(/duas casas/);
    expect(()=>corpoNegociacaoIfood(disputa,"alternativeDispute",{alternativaId:merchant,valor:"1"})).toThrow(/vigente/);
    expect(lerNegociacaoIfood({...disputa,alternatives:[{...disputa.alternatives[0],metadata:{maxAmount:{value:"100",currency:"USD"}}}]}).alternativas).toEqual([]);
  });
  it("valida minutos e motivos contra as opções da negociação",()=>{
    const d={action:"CANCELLATION",handshakeType:"DELAY",alternatives:[{id:alternativaId,type:"ADDITIONAL_TIME",metadata:{allowedsAdditionalTimeInMinutes:[10,20],allowedsAdditionalTimeReasons:["HIGH_STORE_DEMAND"]}}]};
    expect(corpoNegociacaoIfood(d,"alternativeDispute",{alternativaId,minutos:"20",codigo:"HIGH_STORE_DEMAND"})).toEqual({type:"ADDITIONAL_TIME",metadata:{additionalTimeInMinutes:20,reason:"HIGH_STORE_DEMAND"}});
    expect(()=>corpoNegociacaoIfood(d,"alternativeDispute",{alternativaId,minutos:"15",codigo:"HIGH_STORE_DEMAND"})).toThrow(/não oferecido/);
  });
  it("somente confirma por evento posterior correlacionado; outra proposta não comprova sucesso",()=>{
    const corpo={disputeId:merchant,alternativaId,payload:{type:"REFUND"}}, enviadaEm=new Date("2026-10-06T20:00:00Z");
    const e={codigoCompleto:"HANDSHAKE_SETTLEMENT",ocorridoEm:new Date("2026-10-06T20:01:00Z"),metadata:{disputeId:merchant,status:"ALTERNATIVE_REPLIED",selectedDisputeAlternative:{id:alternativaId,type:"REFUND"}}};
    expect(confirmacaoAcaoIfood("alternativeDispute",corpo,enviadaEm,e)).toBe("CONFIRMADA");
    expect(confirmacaoAcaoIfood("alternativeDispute",corpo,enviadaEm,{...e,metadata:{...e.metadata,selectedDisputeAlternative:{id:merchant,type:"REFUND"}}})).toBeNull();
    expect(confirmacaoAcaoIfood("confirm",null,enviadaEm,{codigoCompleto:"CONFIRMED",ocorridoEm:new Date(0),metadata:{}})).toBeNull();
  });
  it("preserva desconto da loja, subsídio iFood e taxa sem projetar taxa como receita da loja",()=>{
    const base=pedidoRemoto(); const p=adaptarPedido({...base,total:{...base.total,benefits:5,additionalFees:1,orderAmount:21.7},benefits:[{value:5,target:"CART",sponsorshipValues:[{name:"IFOOD",value:3},{name:"MERCHANT",value:2}]}],additionalFees:[{type:"SMALL_ORDER_FEE",value:1,liabilities:[{name:"IFOOD",percentage:100}]}],payments:{prepaid:21.7,pending:0,methods:[{...base.payments.methods[0],value:21.7}]}},merchant,"TESTE","UTC");
    expect(p.dados.total).toBe("21.70"); expect(p.dados.desconto).toBe("5.00"); expect(p.valores.descontoLoja).toBe("2.00"); expect(p.valores.patrocinioIfood).toBe("3.00"); expect(p.valores.taxas[0].responsaveis).toEqual([{nome:"IFOOD",percentual:"100"}]);
    expect(obrigacoesFinanceirasIfood(p).metodos.map(m=>m.valor)).toEqual(["23.70"]); expect(p.pendencias).toEqual([]);
  });
  it("não inventa responsável, rateio de cobrança ou frete a receber",()=>{
    const base=pedidoRemoto();
    const p=adaptarPedido({...base,total:{...base.total,benefits:1,orderAmount:24.7},benefits:[{value:1,sponsorshipValues:[{name:"DESCONHECIDO",value:1}]}],payments:{...base.payments,prepaid:24.7,methods:[{...base.payments.methods[0],value:24.7}]}},merchant,"TESTE","UTC");
    expect(obrigacoesFinanceirasIfood(p).pendencia).toContain("desconhecido");
    expect(obrigacoesFinanceirasIfood(adaptarPedido({...base,delivery:{...base.delivery,deliveredBy:"IFOOD"}},merchant,"TESTE","UTC")).pendencia).toContain("Frete");
  });
});
