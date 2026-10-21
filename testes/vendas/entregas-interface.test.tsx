// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const s=vi.hoisted(()=>({salvar:vi.fn(),simular:vi.fn(),calcular:vi.fn(),custos:vi.fn(),cep:vi.fn()}));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("@/app/(protegido)/vendas/produtos/embalagens-actions",()=>({salvarTipoEmbalagemAction:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("next/link",()=>({default:({children,href}:{children:React.ReactNode;href:string})=><a href={href}>{children}</a>}));
vi.mock("@/app/(protegido)/vendas/area-entrega/actions",()=>({salvarEntregasAction:s.salvar,simularEntregaAction:s.simular,buscarCepEntregaAction:s.cep}));
vi.mock("@/app/(protegido)/vendas/pedidos/entregas-actions",()=>({calcularFretePedidoAction:s.calcular}));
vi.mock("@/app/(protegido)/vendas/pedidos/custos-entrega-actions",()=>({salvarCustoEntregaAction:s.custos}));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions",()=>({ buscarCnpjPedidoAction:vi.fn(),buscarCepPedidoAction:s.cep}));
import { EntregasForm } from "@/app/(protegido)/vendas/area-entrega/entregas-form";
import { FretePedido } from "@/app/(protegido)/vendas/pedidos/frete-pedido";
import { CustoEntrega } from "@/app/(protegido)/vendas/pedidos/custo-entrega";
import { entregasVazias } from "@/lib/vendas/entregas-dominio";
import type { PedidoEntrada } from "@/lib/vendas/pedidos-dominio";
const inicial={config:entregasVazias(),versao:0,origemLoja:"",mapasProntos:false,pendencias:["Integração Google Maps pendente"]};
beforeEach(()=>{s.salvar.mockResolvedValue({versao:1});});afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("Interface oficial de Entregas",()=>{
 it.each([false,true])("mostra veículo/ocupação registrados ao reabrir histórico (slots=%s)",(novo)=>{
  const d:PedidoEntrada={clienteId:"c",canalId:"canal",atendimento:"ENTREGA",prazo:"IMEDIATO",previsaoData:null,previsaoJanela:null,destinatario:null,endereco:null,observacoes:"",desconto:"0",frete:"24",veiculoEntregaId:novo?null:"c",itens:[]};
  const veiculos={modelo:"SLOTS"as const,veiculo:null,veiculos:[{id:"c",nome:"Carro",perfil:"CARRO"as const,ativo:true,slotsMinimos:4,slotsMaximos:20}]};
  const selecao={id:"c",nome:"Carro antigo",perfil:"CARRO"as const,regraId:null,embalagens:[],...(novo?{modelo:"SLOTS"as const,escolha:"SLOTS"as const,slotsOcupados:4}:{escolha:"OPERADOR"as const})};
  render(<FretePedido dados={d} alterar={vi.fn()} manual={false} aprovarCobertura={false} configuracaoExistente veiculos={veiculos} slotsOcupados={99} snapshot={{selecaoVeiculo:selecao,freteCobrado:"24.00"}} />);
  expect(screen.getByText("Carro antigo · registrado")).toBeTruthy();expect(screen.getByText(novo?"4 slots ocupados.":"Veículo registrado no pedido.")).toBeTruthy();expect(screen.queryByText(/99 slots/)).toBeNull();
 });
 it("simulador pede somente endereço e veículo e preenche o CEP sem salvar",async()=>{
  s.cep.mockResolvedValue({endereco:{logradouro:"Rua sintética",bairro:"Centro",cidade:"São Paulo",uf:"SP"}});
  render(<EntregasForm inicial={inicial} editar/>);
  fireEvent.click(screen.getByRole("tab",{name:"Simulador de frete"}));
  expect(screen.queryByText("Produtos após desconto")).toBeNull();expect(screen.queryByText("Tipo de embalagem")).toBeNull();expect(screen.queryByText("Modalidade de simulação")).toBeNull();
  const cep=screen.getByRole("textbox",{name:"CEP"});expect(cep).toHaveProperty("required",false);fireEvent.change(cep,{target:{value:"01234567"}});fireEvent.blur(cep);
  await waitFor(()=>expect(screen.getByRole("textbox",{name:"Logradouro"})).toHaveProperty("value","Rua sintética"));
  expect(screen.getByRole("textbox",{name:"Complemento (opcional)"})).toBeTruthy();expect(s.salvar).not.toHaveBeenCalled();
 });
 it("permite escolher veículo e atualiza a indicação automática com a ocupação",()=>{
  const d:PedidoEntrada={clienteId:"c",canalId:"canal",atendimento:"ENTREGA",prazo:"IMEDIATO",previsaoData:null,previsaoJanela:null,destinatario:null,endereco:null,observacoes:"",desconto:"0",frete:"0",itens:[]};
  const veiculos={modelo:"SLOTS"as const,veiculo:null,veiculos:[{id:"m",nome:"Moto",perfil:"MOTO"as const,ativo:true,slotsMinimos:0,slotsMaximos:3},{id:"c",nome:"Carro",perfil:"CARRO"as const,ativo:true,slotsMinimos:4,slotsMaximos:20}]};
  const props={dados:d,alterar:vi.fn(),manual:true,aprovarCobertura:false,configuracaoExistente:true,veiculos};const {rerender}=render(<FretePedido {...props} slotsOcupados={2}/>);
  expect(screen.getByText("Moto · indicado")).toBeTruthy();expect(screen.getByRole("combobox",{name:"Tipo de veículo"})).toHaveProperty("disabled",false);
  rerender(<FretePedido {...props} slotsOcupados={4}/>);expect(screen.getByText("Carro · indicado")).toBeTruthy();expect(screen.getByText("4 slots ocupados.")).toBeTruthy();
  rerender(<FretePedido {...props} slotsOcupados={null}/>);expect(screen.getByText("Slots não informados. Escolha um veículo para este pedido.")).toBeTruthy();
 });
 it("remove os campos antigos e conserva salvamento explícito das faixas",async()=>{
  const config={...entregasVazias(),modelo:"SLOTS"as const,veiculos:[{id:"m",nome:"Moto",perfil:"MOTO"as const,ativo:true,slotsMinimos:0,slotsMaximos:3}],faixas:[{id:"a",limiteMetros:1000,preco:"0",precos:{m:"22.00"}}]};
  render(<EntregasForm inicial={{...inicial,config}} editar/>);
  expect(screen.queryByText("Exceções e regras")).toBeNull();expect(screen.queryByText("Veículos e embalagens")).toBeNull();expect(screen.queryByRole("textbox",{name:"Distância máxima por rota (km)"})).toBeNull();
  const limite=screen.getByRole("textbox",{name:"Limite em km da faixa 1"});fireEvent.change(limite,{target:{value:"1,501"}});fireEvent.blur(limite);expect(s.salvar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Salvar Entregas"}));await waitFor(()=>expect(s.salvar).toHaveBeenCalled());expect(s.salvar.mock.calls[0][0].faixas[0].limiteMetros).toBe(1501);
 });
 it("custo desconhecido não aparece como zero nem como saldo favorável",()=>{const props={id:"p",versao:2,frete:"10",estimado:null,efetivo:null,prestador:null,prestadores:[],editar:false};const {rerender}=render(<CustoEntrega {...props}/>);expect(screen.getByText("Pendente: custo efetivo desconhecido")).toBeTruthy();rerender(<CustoEntrega {...props} efetivo="0"/>);expect(screen.queryByText("Pendente: custo efetivo desconhecido")).toBeNull();expect(screen.getAllByText(/R\$\s*10,00/).length).toBeGreaterThan(1);});
 it("descarta resposta antiga depois de alteração do endereço",async()=>{let resolver!:(v:unknown)=>void;s.calcular.mockReturnValue(new Promise(r=>{resolver=r;}));const d:PedidoEntrada={clienteId:"c",canalId:"canal",atendimento:"ENTREGA",prazo:"IMEDIATO",previsaoData:null,previsaoJanela:null,destinatario:null,endereco:{cep:"01234567",logradouro:"Rua Fictícia",numero:"1",complemento:"",bairro:"Centro",cidade:"São Paulo",uf:"SP"},observacoes:"",desconto:"0",frete:"0",itens:[]};const alterar=vi.fn();const {rerender}=render(<FretePedido dados={d} alterar={alterar} manual aprovarCobertura configuracaoExistente/>);fireEvent.click(screen.getByRole("button",{name:"Calcular frete por rota"}));rerender(<FretePedido dados={{...d,endereco:{...d.endereco!,numero:"2"}}} alterar={alterar} manual aprovarCobertura configuracaoExistente/>);await act(async()=>resolver({resultado:{memoria:{frete:"5"}}}));expect(alterar).not.toHaveBeenCalled();});
});
