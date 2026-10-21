// @vitest-environment jsdom
import { useState } from "react";
import { afterEach,beforeEach,it,expect,vi } from "vitest";
import { render,screen,cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParcelasNota, type DuplicataLinha } from "@/app/(protegido)/notas-fiscais/parcelas-nota";
beforeEach(()=>{vi.stubGlobal("ResizeObserver",class{observe(){}unobserve(){}disconnect(){}});HTMLElement.prototype.scrollIntoView=vi.fn();});afterEach(cleanup);
const cartoes=[{id:"c",nome:"Visa teste",contaBancariaId:"b",contaBancariaNome:"Banco teste",diaFechamento:10,diaVencimento:20,ativo:true}];
function Teste(){const [parcelas,setParcelas]=useState<DuplicataLinha[]>([{numero:"001",valor:"100",dataVencimento:"2026-09-15"}]);return <ParcelasNota parcelas={parcelas} cartoes={cartoes} dataEmissao="2026-09-10" bloqueado={false} onChange={setParcelas}/>;}
it("inicia em boleto e calcula fatura ao selecionar cartão e conta",async()=>{const u=userEvent.setup();render(<Teste/>);expect(screen.getByText("Boleto")).toBeDefined();screen.getByRole("combobox",{name:"Pagamento da parcela 1"}).focus();await u.keyboard("{ArrowDown}");await u.click(screen.getByRole("option",{name:"Cartão de crédito"}));screen.getByRole("combobox",{name:"Cartão da parcela 1"}).focus();await u.keyboard("{ArrowDown}");await u.click(screen.getByRole("option",{name:"Visa teste · Banco teste"}));expect((screen.getByLabelText("Vencimento da parcela 1") as HTMLInputElement).value).toBe("2026-10-20");expect((screen.getByLabelText("Vencimento da parcela 1") as HTMLInputElement).disabled).toBe(true);await u.clear(screen.getByLabelText("Parcela do cartão 1"));await u.type(screen.getByLabelText("Parcela do cartão 1"),"2");expect((screen.getByLabelText("Vencimento da parcela 1") as HTMLInputElement).value).toBe("2026-11-20");});
it("preserva parcelas já lançadas e seu histórico",()=>{render(<ParcelasNota parcelas={[{numero:"001",valor:"100",dataVencimento:"2026-09-15",bloqueada:true}]} cartoes={cartoes} dataEmissao="2026-09-10" bloqueado={false} onChange={vi.fn()}/>);expect(screen.getByText(/Parcela já lançada/)).toBeDefined();expect((screen.getByLabelText("Número da parcela 1") as HTMLInputElement).closest("fieldset")?.disabled).toBe(true);});

it("nova parcela vem antes da anterior sem mudar número, valor ou vencimento",async()=>{
 const u=userEvent.setup();render(<Teste/>);
 await u.click(screen.getByRole("button",{name:"Nova parcela"}));
 expect(screen.getByLabelText("Número da parcela 1")).toHaveProperty("value","002");
 expect(screen.getByLabelText("Número da parcela 2")).toHaveProperty("value","001");
 expect(screen.getByLabelText("Vencimento da parcela 2")).toHaveProperty("value","2026-09-15");
 const valor=screen.getByLabelText("Valor da parcela 001 em reais");
 expect(valor).toHaveProperty("value","100,00");
 await u.click(screen.getByRole("button",{name:"Nova parcela"}));
 expect(screen.getByLabelText("Número da parcela 1")).toHaveProperty("value","003");
 expect(screen.getByLabelText("Número da parcela 3")).toHaveProperty("value","001");
 expect(screen.getByLabelText("Valor da parcela 001 em reais")).toHaveProperty("value","100,00");
});
