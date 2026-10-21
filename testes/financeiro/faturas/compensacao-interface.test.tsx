// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FaturaView } from "@/app/(protegido)/financeiro/cartoes/fatura-view";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { cadastros, faturaVisual } from "./dados-interface";
const a=vi.hoisted(()=>({compensar:vi.fn(async()=>({ok:true})),desfazer:vi.fn(async()=>({ok:true})),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:a.refresh,replace:vi.fn()})}));
vi.mock("@/app/(protegido)/financeiro/cartoes/actions",()=>({compensarItensFaturaAction:a.compensar,desfazerCompensacaoFaturaAction:a.desfazer,correspondenciasFaturaAction:vi.fn(async()=>({candidatos:[],estornos:[],sugestao:null})),classificarFaturaAction:vi.fn(),ajustarItemFaturaAction:vi.fn(),cancelarFaturaAction:vi.fn(),desfazerPagamentoFaturaAction:vi.fn(),pagarFaturaAction:vi.fn(),vincularFaturaAction:vi.fn(),concluirDespesasFaturaAction:vi.fn(),corrigirCartaoDespesaAction:vi.fn()}));
vi.mock("@/app/(protegido)/financeiro/cartoes/importar",()=>({ImportarFatura:()=>null}));
vi.mock("@/app/(protegido)/fornecedores/fornecedor-dialog",()=>({FornecedorDialog:()=>null}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const par=()=>({...faturaVisual,selecionada:null,itens:[{...faturaVisual.itens[0],descricao:"Anuidade fictícia",valor:1875},{...faturaVisual.itens[1],descricao:"Crédito fictício",data:"2026-09-01",valor:-1875}]});
function montar(dados=par(),admin=true){return render(<ProvedorAcesso acesso={{admin,permissoes:{"financeiro.faturas":["visualizar"]},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);}
function selecionar(){fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar Anuidade fictícia para classificação"}));fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar Crédito fictício para classificação"}));}
it("seleciona cobrança e crédito do mesmo dia e só grava após confirmação com motivo",async()=>{
  montar();const botao=screen.getByRole("button",{name:"Compensar selecionados"});expect(botao).toHaveProperty("disabled",true);
  selecionar();expect(botao).toHaveProperty("disabled",false);fireEvent.click(botao);
  expect(a.compensar).not.toHaveBeenCalled();const dialogo=screen.getByRole("dialog");
  expect(dialogo.textContent).toContain("saldo do dia permanecem iguais");
  expect(within(dialogo).getByRole("button",{name:"Confirmar"})).toHaveProperty("disabled",true);
  fireEvent.change(within(dialogo).getByRole("textbox",{name:"Motivo"}),{target:{value:"Estorno integral da anuidade"}});
  fireEvent.click(within(dialogo).getByRole("button",{name:"Confirmar"}));
  await waitFor(()=>expect(a.compensar).toHaveBeenCalledWith("ficticia",1,"i0","i1","Estorno integral da anuidade"));
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
});
it.each([{data:"2026-09-02"},{valor:-1874},{valor:1875}])("não libera compensação com datas, centavos ou sinais diferentes %j",alteracao=>{
  const d=par();d.itens[1]={...d.itens[1],...alteracao};montar(d);selecionar();expect(screen.getByRole("button",{name:"Compensar selecionados"})).toHaveProperty("disabled",true);
});
it("sem edição pode consultar e selecionar, mas não confirmar compensação",()=>{montar(par(),false);selecionar();expect(screen.getByRole("button",{name:"Compensar selecionados"})).toHaveProperty("disabled",true);});
it("mostra o par compensado sem classificação e exige motivo para desfazer",async()=>{
  const d=par();d.itens=d.itens.map((i,n)=>({...i,estado:"COMPENSADO",compensadoComId:n===0?"i1":"i0"}));
  montar(d);expect(screen.getByText("Este item foi compensado na própria fatura. Não há lançamento do HUB a vincular.")).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Classificar despesa"})).toBeNull();
  expect(screen.getByRole("checkbox",{name:"Selecionar Anuidade fictícia para classificação"}).getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(screen.getByRole("button",{name:"Desfazer compensação"}));
  const dialogo=screen.getByRole("dialog");fireEvent.change(within(dialogo).getByRole("textbox",{name:"Motivo"}),{target:{value:"Revisar origem do crédito"}});
  fireEvent.click(within(dialogo).getByRole("button",{name:"Confirmar"}));
  await waitFor(()=>expect(a.desfazer).toHaveBeenCalledWith("ficticia",1,"i0","Revisar origem do crédito"));
});
it("erro do servidor mantém confirmação aberta e permite corrigir",async()=>{
  a.compensar.mockResolvedValueOnce({erro:"A fatura mudou. Atualize a tela."} as never);
  montar();selecionar();fireEvent.click(screen.getByRole("button",{name:"Compensar selecionados"}));
  const dialogo=screen.getByRole("dialog");fireEvent.change(within(dialogo).getByRole("textbox",{name:"Motivo"}),{target:{value:"Compensação fictícia"}});fireEvent.click(within(dialogo).getByRole("button",{name:"Confirmar"}));
  await screen.findByRole("alert");expect(screen.getByRole("dialog")).toBeTruthy();expect(a.refresh).not.toHaveBeenCalled();
});
