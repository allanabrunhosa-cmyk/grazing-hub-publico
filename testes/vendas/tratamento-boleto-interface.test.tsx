// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ cancelar: vi.fn(), tardio: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ registrarCancelamentoBoletoPedidoAction: sim.cancelar, registrarEntradaTardiaBoletoPedidoAction: sim.tardio }));
import { TratamentoBoleto } from "@/app/(protegido)/vendas/pedidos/tratamento-boleto";
import { PedidoPopupContext } from "@/app/(protegido)/vendas/pedidos/modal-pedido";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("cancelamento exige evidência, confirmação e preserva preenchimento no erro", async () => {
  sim.cancelar.mockResolvedValue({ erro: "Boleto indisponível" }); render(<TratamentoBoleto pedidoId="p" cobrancaId="b" tardio={false} contas={[]} />); const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Registrar cancelamento externo do boleto" }));
  expect((screen.getByRole("button", { name: "Confirmar registro" }) as HTMLButtonElement).disabled).toBe(true);
  await u.type(screen.getByLabelText("Evidência externa"), "Comprovante fictício do emissor"); expect(sim.cancelar).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Confirmar registro" })); expect((await screen.findByRole("alert")).textContent).toContain("Boleto indisponível");
  await u.click(screen.getByRole("button", { name: "Confirmar registro" })); expect(sim.cancelar.mock.calls[0]).toEqual(sim.cancelar.mock.calls[1]); expect(sim.tardio).not.toHaveBeenCalled();
});
it("protege edição comercial antes de registrar efeito externo", async () => {
  render(<PedidoPopupContext.Provider value={{ retorno: "/vendas/pedidos", marcarAlterado: vi.fn(), marcarSalvo: vi.fn(), temAlteracoes: () => true, navegar: vi.fn(), bloquearSaida: vi.fn() }}><TratamentoBoleto pedidoId="p" cobrancaId="b" tardio={false} contas={[]} /></PedidoPopupContext.Provider>); const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Registrar cancelamento externo do boleto" })); await u.type(screen.getByLabelText("Evidência externa"), "Comprovante fictício"); await u.click(screen.getByRole("button", { name: "Confirmar registro" }));
  expect((await screen.findByRole("alert")).textContent).toContain("alterações comerciais"); expect(sim.cancelar).not.toHaveBeenCalled();
});
