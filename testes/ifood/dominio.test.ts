import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { adaptarPedido } from "@/lib/ifood/adaptador";
import { acoesPermitidas, estadoInterno, lerEvento, proximoEstado, moeda } from "@/lib/ifood/dominio";
import { chamarIfood, esperaResposta, lerToken } from "@/lib/ifood/cliente";
import { merchant, orderId, pedidoRemoto } from "./fixtures";
describe("Contrato operacional iFood", () => {
  it("preserva valores, adicionais, ausência de cliente cadastrado e fuso", () => {
    const p = adaptarPedido(pedidoRemoto(), merchant, "TESTE", "America/Sao_Paulo");
    expect(p.dados.total).toBe("25.70"); expect(p.itens[0].totalLinha).toBe("22.20");
    expect(p.itens[0].escolhasSnapshot[0].opcaoNome).toBe("Adicional de teste");
    expect(p.dados.previsaoJanela).toBe("18:00"); expect(p.pendencias).toEqual([]);
    expect(p.dados.destinatarioSnapshot.contato).toBe("");
  });
  it("preserva preparo, previsão e janela na virada do dia sem transformá-la em hora exata", () => {
    const p = adaptarPedido({...pedidoRemoto(), orderTiming:"SCHEDULED", preparationStartDateTime:"2026-10-06T02:00:00Z", schedule:{deliveryDateTimeStart:"2026-10-06T02:30:00Z", deliveryDateTimeEnd:"2026-10-06T04:30:00Z"},delivery:{deliveredBy:"MERCHANT",deliveryDateTime:"2026-10-06T03:00:00Z"}},merchant,"TESTE","America/Sao_Paulo");
    expect(p.horarios.janelaInicio?.toISOString()).toBe("2026-10-06T02:30:00.000Z");
    expect(p.horarios.janelaFim?.toISOString()).toBe("2026-10-06T04:30:00.000Z");
    expect(p.horarios.entregaRetirada?.toISOString()).toBe("2026-10-06T03:00:00.000Z");
    expect(p.inicioPreparo?.toISOString()).toBe("2026-10-06T02:00:00.000Z");
    expect(p.dados.previsaoData?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(p.dados.previsaoJanela).toBe("05/10/2026, 23:30 – 06/10/2026, 01:30");
    expect(p.pendencias).toEqual([]);
  });
  it("mantém horários inconsistentes recebidos e sinaliza sem corrigir datas", () => {
    const p = adaptarPedido({...pedidoRemoto(), orderTiming:"SCHEDULED",preparationStartDateTime:"2026-01-22T18:20:24.778Z",schedule:{deliveryDateTimeStart:"2026-10-07T05:39:44.280Z",deliveryDateTimeEnd:"2026-10-07T06:39:44.280Z"}},merchant,"TESTE","America/Sao_Paulo");
    expect(p.inicioPreparo?.toISOString()).toBe("2026-01-22T18:20:24.778Z");
    expect(p.dados.previsaoJanela).toBe("02:39–03:39");
    expect(p.pendencias).toContain("Início de preparo anterior à criação do pedido agendado");
  });
  it("aceitar agendado antes do preparo não libera iniciar preparo", () => {
    const c={estado:"PLACED",modalidade:"TAKEOUT",entregaPor:null,inicioPreparo:new Date("2026-10-06T05:00:00Z"),confirmarAte:new Date("2026-10-06T05:08:00Z"),pendente:false,autorizada:true};
    expect(acoesPermitidas(c,new Date("2026-10-06T04:00:00Z"))).toContain("confirm");
    expect(acoesPermitidas({...c,estado:"CONFIRMED"},new Date("2026-10-06T04:00:00Z"))).not.toContain("startPreparation");
    expect(acoesPermitidas(c,new Date("2026-10-06T05:08:00Z"))).not.toContain("confirm");
  });
  it("não converte centavos duas vezes nem aceita arredondamento silencioso", () => {
    expect(moeda(0.1).plus(moeda(0.2)).toFixed(2)).toBe("0.30");
    expect(() => moeda("12.345")).toThrow(); expect(() => moeda(-1)).toThrow();
  });
  it("detecta totais divergentes sem perder detalhes recebidos", () => {
    const p = pedidoRemoto(); p.total.orderAmount = 26;
    expect(adaptarPedido(p,merchant,"TESTE","UTC").pendencias.length).toBe(2);
  });
  it("rejeita outra loja e pedido real em teste", () => {
    expect(()=>adaptarPedido(pedidoRemoto(),orderId,"TESTE","UTC")).toThrow("loja");
    expect(()=>adaptarPedido({...pedidoRemoto(),isTest:false},merchant,"TESTE","UTC")).toThrow("real");
    expect(()=>adaptarPedido({...pedidoRemoto(),isTest:undefined,test:true},merchant,"TESTE","UTC")).toThrow("ambiente");
    expect(()=>adaptarPedido(pedidoRemoto(),merchant,"PRODUCAO","UTC")).toThrow("teste");
  });
  it("contextualiza evento sem merchantId apenas no polling de uma loja", () => {
    expect(lerEvento({ id:orderId,orderId,code:"PLC",fullCode:"PLACED",createdAt:"2026-10-05T20:00:00Z"},merchant).merchantId).toBe(merchant);
    expect(()=>lerEvento({ id:orderId,orderId,merchantId:orderId },merchant)).toThrow();
  });
  it("não reabre terminal, não aplica desconhecido e pronto não é entregue", () => {
    const ev={code:"PLC",fullCode:"PLACED",createdAt:new Date()};
    expect(proximoEstado("CONCLUDED",ev,null)).toBeNull();
    expect(proximoEstado("CANCELLED",{...ev,code:"CFM",fullCode:"CONFIRMED"},null)).toBeNull();
    expect(proximoEstado("CONFIRMED",{...ev,code:"FUTURO"},null)).toBeNull();
    expect(estadoInterno("READY_TO_PICKUP")).toBe("PRONTO");
    expect(proximoEstado("CONFIRMED",{...ev,code:"PRS",fullCode:"PREPARATION_STARTED"},null)).toBe("PREPARATION_STARTED");
  });
  it("bloqueia evento atrasado e códigos inconsistentes", () => {
    const e={code:"RTP",fullCode:"READY_TO_PICKUP",createdAt:new Date(0)};
    expect(proximoEstado("CONFIRMED",e,new Date())).toBeNull();
    expect(proximoEstado("CONFIRMED",{...e,code:"CAN"},null)).toBeNull();
  });
  it("matriz respeita agendamento, responsabilidade de entrega e pendências", () => {
    const c={estado:"CONFIRMED",modalidade:"DELIVERY",entregaPor:"IFOOD",inicioPreparo:new Date("2099-01-01"),pendente:false,autorizada:true};
    expect(acoesPermitidas(c)).toEqual(["requestCancellation"]);
    expect(acoesPermitidas({...c,estado:"READY_TO_PICKUP",inicioPreparo:null})).not.toContain("dispatch");
    expect(acoesPermitidas({...c,estado:"READY_TO_PICKUP",entregaPor:"MERCHANT"})).toContain("dispatch");
    expect(acoesPermitidas({...c,pendente:true})).toEqual([]);
    expect(acoesPermitidas({...c,autorizada:false})).toEqual([]);
  });
  it("distingue consumo no local de retirada e não confirma após o prazo", () => {
    expect(adaptarPedido({...pedidoRemoto(),orderType:"DINE_IN"},merchant,"TESTE","America/Sao_Paulo").dados.atendimento).toBe("LOCAL");
    expect(adaptarPedido({...pedidoRemoto(),orderType:"TAKEOUT"},merchant,"TESTE","America/Sao_Paulo").dados.atendimento).toBe("RETIRADA");
    const contexto={estado:"PLACED",modalidade:"DELIVERY",entregaPor:"MERCHANT",inicioPreparo:null,pendente:false,autorizada:true,confirmarAte:new Date(0)};
    expect(acoesPermitidas(contexto)).not.toContain("confirm");
    expect(acoesPermitidas({...contexto,confirmarAte:new Date("2099-01-01")})).toContain("confirm");
  });
  it("expiração vem da resposta", () => {
    const agora=Date.now(); expect(lerToken({accessToken:"sintetico",expiresIn:123}).expiraEm.getTime()).toBeGreaterThanOrEqual(agora+123000);
    expect(()=>lerToken({accessToken:"sintetico"})).toThrow();
  });
  it("preserva fim isolado da janela sem inventar seu início nem transformá-la em hora única",()=>{
    const fim="2026-10-07T04:30:00Z";
    const p=adaptarPedido({...pedidoRemoto(),schedule:{deliveryDateTimeEnd:fim}},merchant,"TESTE","America/Sao_Paulo");
    expect(p.horarios.janelaInicio).toBeNull();expect(p.horarios.janelaFim?.toISOString()).toBe("2026-10-07T04:30:00.000Z");
    expect(p.dados.previsaoJanela).toBe("Até 07/10/2026, 01:30; início não informado");
  });
  it("respeita Retry-After em segundos/data e não repete POST incerto", async () => {
    expect(esperaResposta(new Headers({"retry-after":"91"}))).toBe(91000);
    expect(esperaResposta(new Headers({"retry-after":"Mon, 05 Oct 2026 20:00:00 GMT"}),Date.parse("2026-10-05T19:59:00Z"))).toBe(60000);
    const f=vi.fn().mockRejectedValue(new Error("timeout")); vi.stubGlobal("fetch",f);
    await expect(chamarIfood("/order/v1.0/orders/test/confirm",{metodo:"POST"})).rejects.toMatchObject({status:0});
    expect(f).toHaveBeenCalledTimes(1); vi.unstubAllGlobals();
  });
});
