// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ buscar: vi.fn(), vincular: vi.fn(), remover: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/custos-entrega-actions", () => ({ buscarDespesasEntregaAction: sim.buscar, vincularDespesaEntregaAction: sim.vincular, desvincularDespesaEntregaAction: sim.remover }));
import { DespesasEntrega } from "@/app/(protegido)/vendas/pedidos/despesas-entrega";
const base = { pedidoId: "pedido", versao: 4, efetivo: "50", financeiroHref: "/financeiro/lancamentos", vinculos: [] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("busca a despesa existente e confirma rateio explicitamente, preservando dados no conflito", async () => {
  sim.buscar.mockResolvedValue({ despesas: [{ id: "despesa", descricao: "Transporte fictício", categoria: "Categoria fictícia", valor: "100", disponivel: "50", revisao: "2026-10-02", status: "BAIXADO", competencia: "2026-09-30" }] });
  sim.vincular.mockResolvedValue({ erro: "Despesa alterada. Busque novamente." }); render(<DespesasEntrega {...base} />); const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Vincular despesa existente" })); await u.type(screen.getByLabelText("Buscar descrição ou fornecedor"), "Transporte"); await u.click(screen.getByRole("button", { name: "Buscar despesas" }));
  await u.click(screen.getByRole("combobox", { name: "Despesa existente" })); await u.click(await screen.findByRole("option", { name: /Transporte fictício/ }));
  await u.type(screen.getByLabelText("Valor desta entrega"), "2000"); await u.type(screen.getByLabelText("Justificativa do vínculo"), "Rateio fictício entre entregas");
  expect(sim.vincular).not.toHaveBeenCalled(); await u.click(screen.getByRole("button", { name: "Confirmar vínculo" })); expect((await screen.findByRole("alert")).textContent).toContain("Despesa alterada");
  expect(sim.vincular.mock.calls[0][0]).toMatchObject({ pedidoId: "pedido", versao: 4, lancamentoId: "despesa", valor: "20.00" });
  await u.click(screen.getByRole("button", { name: "Confirmar vínculo" })); expect(sim.vincular.mock.calls[1][0].chave).toBe(sim.vincular.mock.calls[0][0].chave);
});
it("X abre confirmação de desvinculação; não apaga lançamento e exige motivo", async () => {
  sim.remover.mockResolvedValue({ ok: true }); render(<DespesasEntrega {...base} vinculos={[{ id: "vinculo", valor: "20", lancamento: { descricao: "Transporte fictício", status: "BAIXADO" } }]} />); const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Desvincular despesa Transporte fictício" })); expect(sim.remover).not.toHaveBeenCalled(); expect((screen.getByRole("button", { name: "Confirmar desvinculação" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/O lançamento e seu pagamento permanecem/)).toBeTruthy(); await u.type(screen.getByLabelText("Justificativa do vínculo"), "Correção do rateio fictício"); await u.click(screen.getByRole("button", { name: "Confirmar desvinculação" })); expect(sim.remover).toHaveBeenCalledWith("vinculo", "Correção do rateio fictício", expect.any(String));
});
