// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const sim=vi.hoisted(()=>({consultar:vi.fn(),enviar:vi.fn()}));
vi.mock("@/app/(protegido)/vendas/pedidos/ifood/actions",()=>({consultarMerchantIfoodAction:sim.consultar,solicitarMerchantIfoodAction:sim.enviar}));
import { OperacaoMerchantIfood } from "@/app/(protegido)/vendas/pedidos/ifood/merchant-ifood";
const dados={fusoHorario:"America/Sao_Paulo",consultadoEm:"2026-10-07T02:40:00Z",hashHorarios:"sintetico",pausas:[],horarios:{storeId:"sintetico",shifts:[{dayOfWeek:"MONDAY",start:"09:00:00",duration:60,enabled:true}]},acoes:[]};
afterEach(()=>{cleanup();vi.clearAllMocks()});
it("edita rascunho sem salvar ao perder foco, limita duração e usa o X oficial",async()=>{
 sim.consultar.mockResolvedValue({ok:true,dados});render(<OperacaoMerchantIfood lojaId="sintetico" ambiente="TESTE"/>);
 await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Consultar pausas e horários"})));
 fireEvent.click(screen.getByRole("button",{name:"Editar horários da loja de teste"}));
 const duracao=screen.getByLabelText("Duração do turno 1 (min)");fireEvent.change(duracao,{target:{value:"abc"}});expect((duracao as HTMLInputElement).value).toBe("60");
 fireEvent.change(duracao,{target:{value:"120"}});fireEvent.blur(duracao);expect(sim.enviar).not.toHaveBeenCalled();
 expect(screen.getByRole("button",{name:"Remover turno 1 do rascunho"}).getAttribute("data-acao")).toBe("remover-item");
});
it("bloqueia alteração em produção e mostra erro de rede compreensível",async()=>{
 sim.consultar.mockResolvedValue({ok:true,dados});render(<OperacaoMerchantIfood lojaId="sintetico" ambiente="PRODUCAO"/>);
 await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Consultar pausas e horários"})));
 expect(screen.queryByRole("button",{name:"Pausar loja de teste"})).toBeNull();expect(screen.queryByRole("button",{name:"Editar horários da loja de teste"})).toBeNull();
 sim.consultar.mockRejectedValue(new Error("Falha simulada"));await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Consultar pausas e horários"})));
 expect(screen.getByRole("status").textContent).toContain("Não foi possível consultar");
});
it("impede envios repetidos e mantém pendência visível após aceite da tarefa",async()=>{
 sim.consultar.mockResolvedValue({ok:true,dados});let resolver!:(v:{ok:boolean})=>void;sim.enviar.mockImplementation(()=>new Promise(r=>{resolver=r}));
 render(<OperacaoMerchantIfood lojaId="sintetico" ambiente="TESTE"/>);await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Consultar pausas e horários"})));
 const enviar=screen.getByRole("button",{name:"Pausar loja de teste"});fireEvent.click(enviar);fireEvent.click(enviar);expect(sim.enviar).toHaveBeenCalledTimes(1);
 sim.consultar.mockResolvedValue({ok:true,dados:{...dados,acoes:[{id:"tarefa",acao:"PAUSAR",estado:"INCERTA",erro:"Conferência pendente",createdAt:dados.consultadoEm}]}});
 await act(async()=>resolver({ok:true}));expect(screen.getByText(/Conferência pendente/)).toBeTruthy();expect(enviar.matches(":disabled")).toBe(true);
});
