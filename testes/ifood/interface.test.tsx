// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
const sim=vi.hoisted(()=>({enviar:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:sim.refresh})}));
vi.mock("next/link",()=>({default:(p:ComponentProps<"a">)=><a {...p}/> }));
vi.mock("@/app/(protegido)/vendas/pedidos/ifood/actions",()=>({acaoPedidoIfoodAction:sim.enviar,motivosIfoodAction:vi.fn(),gerarFinanceiroIfoodAction:vi.fn()}));
import { PedidoIfood, type DadosPedidoIfood } from "@/app/(protegido)/vendas/pedidos/ifood/pedido-ifood";
import { AtualizacaoIfood } from "@/app/(protegido)/vendas/pedidos/ifood/atualizacao-ifood";
const dados:DadosPedidoIfood={acompanhamento:false,displayId:"TESTE-01",horarioInconsistente:false,problemasHorarios:[],podeConferir:true,valores:{beneficios:[],taxas:[],problemas:[],descontoLoja:"0.00",patrocinioIfood:"0.00",taxasIfood:"0.00"},obrigacoesFinanceiras:{metodos:[],pendencia:null},horarios:{agendado:false,entregaRetirada:null,janelaInicio:null,janelaFim:null},pedidoId:"sintetico",numero:1,versao:2,ambiente:"TESTE",loja:"Loja sintética",merchantId:"sintetico",externoId:"sintetico",estado:"DISPATCHED",modalidade:"DELIVERY",entregaPor:"MERCHANT",inicioPreparo:null,confirmarAte:null,fusoHorario:"America/Sao_Paulo",total:"25.70",cliente:"Cliente não informado pelo iFood",observacoes:null,endereco:null,contato:null,pagamentos:{metodos:[]},pendencia:null,financeiroPendente:false,autorizada:true,acoesPermitidas:["verifyDeliveryCode"],formasFinanceiras:[],negociacao:null,revisaoPendente:false,itens:[],acoes:[],historico:[]};
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks()});
describe("Detalhes iFood no gestor",()=>{
 it("identifica acompanhamento de produção sem rotular como teste nem oferecer comandos ou comanda",()=>{
  render(<PedidoIfood dados={{...dados,acompanhamento:true,ambiente:"PRODUCAO",podeConferir:false}}/>);
  expect(screen.getByText(/Acompanhamento — Takeat/)).toBeTruthy();
  expect(screen.queryByText(/Pedido de teste do iFood/)).toBeNull();
  expect(screen.queryByRole("button",{name:"Validar entrega"})).toBeNull();
  expect(screen.queryByRole("button",{name:"Comanda"})).toBeNull();
  expect(screen.queryByRole("link",{name:"Comanda"})).toBeNull();
  expect(document.querySelector('a[href="/vendas/pedidos/sintetico/comanda"]')).toBeNull();
 });
 it("mostra identificação oficial e alerta de horário inconsistente sem liberar confirmação bloqueada",()=>{
  render(<PedidoIfood dados={{...dados,estado:"PLACED",horarioInconsistente:true,problemasHorarios:["Início de preparo anterior à criação do pedido agendado"],acoesPermitidas:[]}}/>);
  expect(screen.getByText("Pedido iFood: TESTE-01")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("anterior à criação");
  expect(screen.queryByRole("button",{name:"Confirmar pedido"})).toBeNull();
 });
 it("exibe início e fim da janela, previsão e preparo independentemente",()=>{
  render(<PedidoIfood dados={{...dados,inicioPreparo:"2026-10-06T02:00:00Z",horarios:{agendado:true,janelaInicio:"2026-10-06T02:30:00Z",janelaFim:"2026-10-06T04:30:00Z",entregaRetirada:"2026-10-06T03:00:00Z"}}}/>);
  expect(screen.getByText(/Janela de entrega:/).textContent).toContain("06/10/2026");
  expect(screen.getByText(/Janela de entrega:/).textContent).toContain("23:30");
  expect(screen.getByText(/Janela de entrega:/).textContent).toContain("01:30");
  expect(screen.getByText(/Previsão de entrega informada:/).textContent).toContain("00:00");
  expect(screen.getByText(/Início de preparo:/).textContent).toContain("23:00");
 });
 it("atualiza a leitura sem interromper campo em edição e para ao desmontar",()=>{
  vi.useFakeTimers();
  Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});
  const pagina=render(<><AtualizacaoIfood/><input aria-label="Anotação em edição"/></>);
  act(()=>vi.advanceTimersByTime(30000));expect(sim.refresh).toHaveBeenCalledTimes(1);
  screen.getByRole("textbox",{name:"Anotação em edição"}).focus();
  act(()=>vi.advanceTimersByTime(30000));expect(sim.refresh).toHaveBeenCalledTimes(1);
  pagina.unmount();act(()=>vi.advanceTimersByTime(30000));expect(sim.refresh).toHaveBeenCalledTimes(1);
 });
 it("aceita somente quatro dígitos e impede envio duplo enquanto aguarda a rede",async()=>{
  let resolver!:(v:{ok:boolean})=>void;sim.enviar.mockImplementation(()=>new Promise(r=>{resolver=r}));
  render(<PedidoIfood dados={dados}/>);fireEvent.click(screen.getByRole("button",{name:"Validar entrega"}));
  const campo=screen.getByRole("textbox",{name:"Código de entrega"});fireEvent.change(campo,{target:{value:"a12b345"}});expect((campo as HTMLInputElement).value).toBe("");fireEvent.change(campo,{target:{value:"1234"}});fireEvent.change(campo,{target:{value:"12345"}});expect((campo as HTMLInputElement).value).toBe("1234");
  const enviar=screen.getByRole("button",{name:"Enviar solicitação"});fireEvent.click(enviar);fireEvent.click(enviar);
  expect(sim.enviar).toHaveBeenCalledTimes(1);expect(sim.enviar.mock.calls[0][3]).toEqual({codigo:"1234",motivo:""});
  await act(async()=>resolver({ok:true}));expect(screen.getByRole("status").textContent).toContain("aguardando processamento");
 });
 it("falha de conexão conserva a chave para conferir/repetir a solicitação sem duplicá-la",async()=>{
  sim.enviar.mockRejectedValue(new Error("falha simulada"));render(<PedidoIfood dados={dados}/>);
  fireEvent.click(screen.getByRole("button",{name:"Validar entrega"}));fireEvent.change(screen.getByRole("textbox",{name:"Código de entrega"}),{target:{value:"1234"}});
  await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Enviar solicitação"})));
  expect(screen.getByRole("status").textContent).toContain("Falha de conexão");const chave=sim.enviar.mock.calls[0][4];
  await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Enviar solicitação"})));expect(sim.enviar.mock.calls[1][4]).toBe(chave);
 });
 it("leitor consulta o pedido sem comandos de alteração nem geração financeira",()=>{
  render(<PedidoIfood dados={{...dados,acoesPermitidas:[]}}/>);expect(screen.queryByRole("button",{name:"Validar entrega"})).toBeNull();expect(screen.queryByRole("button",{name:"Gerar títulos"})).toBeNull();expect(screen.getByText("Cliente não informado pelo iFood")).toBeTruthy();
 });
});
