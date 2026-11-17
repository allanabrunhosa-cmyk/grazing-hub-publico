// @vitest-environment jsdom
import { useState } from "react";
import { afterEach,beforeEach,it,expect,vi } from "vitest";
import { render,screen,cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParcelasNota, type DuplicataLinha } from "@/app/(protegido)/notas-fiscais/parcelas-nota";
beforeEach(()=>{vi.stubGlobal("ResizeObserver",class{observe(){}unobserve(){}disconnect(){}});HTMLElement.prototype.scrollIntoView=vi.fn();});afterEach(cleanup);
const cartoes=[{id:"c",nome:"Visa teste",contaBancariaId:"b",contaBancariaNome:"Banco teste",diaFechamento:10,diaVencimento:20,ativo:true}];
function Teste(){const [parcelas,setParcelas]=useState<DuplicataLinha[]>([{numero:"001",valor:"100",dataVencimento:"2026-09-15"}]);return <ParcelasNota parcelas={parcelas} cartoes={cartoes} dataEmissao="2026-09-10" bloqueado={false} onChange={setParcelas}/>;}
it("inicia em boleto e calcula fatura ao selecionar cartão e conta",async()=>{const u=userEvent.setup();render(<Teste/>);expect(screen.getByText("Boleto")).toBeDefined();screen.getByRole("combobox",{name:"Pagamento da parcela 1"}).focus();await u.keyboard("{ArrowDown}");await u.click(screen.getByRole("option",{name:"Cartão de crédito"}));screen.getByRole("combobox",{name:"Cartão da parcela 1"}).focus();await u.keyboard("{ArrowDown}");await u.click(screen.getByRole("option",{name:"Visa teste · Banco teste"}));expect((screen.getByLabelText("Vencimento da parcela 1") as HTMLInputElement).value).toBe("2026-10-20");expect((screen.getByLabelText("Vencimento da parcela 1") as HTMLInputElement).disabled).toBe(true);await u.clear(screen.getByLabelText("Número da parcela no cartão 1"));await u.type(screen.getByLabelText("Número da parcela no cartão 1"),"2");expect((screen.getByLabelText("Vencimento da parcela 1") as HTMLInputElement).value).toBe("2026-11-20");});
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

function CompraCartao({ bloqueada = false }: { bloqueada?: boolean }) {
  const [parcelas, setParcelas] = useState<DuplicataLinha[]>([{ id: "original", numero: "001", valor: "149.52", dataVencimento: "2027-01-20", formaPagamento: "CARTAO", cartaoCreditoId: "c", dataCompra: "2026-09-25", parcelaCartao: 4, bloqueada }]);
  return <ParcelasNota parcelas={parcelas} cartoes={cartoes} dataEmissao="2026-09-28" bloqueado={false} onChange={setParcelas} />;
}

it("só divide após ação explícita e apresenta quatro parcelas conciliáveis", async () => {
  const u = userEvent.setup(); render(<CompraCartao />);
  const quantidade = screen.getByLabelText("Quantidade de parcelas para dividir 1");
  await u.clear(quantidade); await u.type(quantidade, "4"); await u.tab();
  expect(screen.getAllByLabelText(/Valor da parcela .* em reais/)).toHaveLength(1);
  expect(screen.getByLabelText("Valor da parcela 001 em reais")).toHaveProperty("value", "149,52");
  await u.click(screen.getByRole("button", { name: "Dividir em parcelas o valor da parcela 1" }));
  expect(screen.getAllByLabelText(/Valor da parcela .* em reais/)).toHaveLength(4);
  for (let i = 1; i <= 4; i++) {
    expect(screen.getByLabelText(`Valor da parcela ${String(i).padStart(3, "0")} em reais`)).toHaveProperty("value", "37,38");
    expect(screen.getByLabelText(`Número da parcela no cartão ${i}`)).toHaveProperty("value", String(i));
  }
  expect(screen.getByLabelText("Vencimento da parcela 1")).toHaveProperty("value", "2026-10-20");
  expect(screen.getByLabelText("Vencimento da parcela 4")).toHaveProperty("value", "2027-01-20");
});

it("rejeita quantidade fora do limite sem alterar o lançamento", async () => {
  const u = userEvent.setup(); render(<CompraCartao />);
  const quantidade = screen.getByLabelText("Quantidade de parcelas para dividir 1");
  await u.clear(quantidade); await u.type(quantidade, "121");
  await u.click(screen.getByRole("button", { name: "Dividir em parcelas o valor da parcela 1" }));
  expect(screen.getByRole("alert").textContent).toContain("2 a 120");
  expect(screen.getByLabelText("Valor da parcela 001 em reais")).toHaveProperty("value", "149,52");
});

it("não permite dividir uma parcela bloqueada", () => {
  render(<CompraCartao bloqueada />);
  expect(screen.getByRole("button", { name: "Dividir em parcelas o valor da parcela 1" }).closest("fieldset")?.disabled).toBe(true);
});
