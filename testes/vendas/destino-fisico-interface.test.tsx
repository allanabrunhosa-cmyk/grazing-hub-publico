// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ executar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ executarOperacaoPedidoAction: sim.executar }));
import { DestinoFisico } from "@/app/(protegido)/vendas/pedidos/destino-fisico";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("exige confirmação explícita, protege quantidade inteira e conserva os dados no erro", async () => {
  sim.executar.mockResolvedValue({ erro: "Recuperável e perda devem fechar exatamente" });
  render(<DestinoFisico pedidoId="p" versao={3} ocorrenciaId="o" destino={{ origem: "CANCELAMENTO", itemId: "i", produto: "Caixa preparada", unidade: "UN", quantidade: "2" }} />);
  const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Definir destino físico" }));
  await u.type(screen.getByLabelText("Recuperável (UN)"), "x1"); await u.type(screen.getByLabelText("Perda (UN)"), "0");
  await u.type(screen.getByLabelText("Destino, condição e responsável pelo material"), "Caixa íntegra sob guarda da cozinha");
  expect((screen.getByLabelText("Recuperável (UN)") as HTMLInputElement).value).toBe("1"); expect(sim.executar).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Confirmar destino" })); expect((await screen.findByRole("alert")).textContent).toContain("fechar exatamente");
  await u.click(screen.getByRole("button", { name: "Confirmar destino" })); expect(sim.executar.mock.calls[0]).toEqual(sim.executar.mock.calls[1]);
  expect((screen.getByLabelText("Destino, condição e responsável pelo material") as HTMLInputElement).value).toBe("Caixa íntegra sob guarda da cozinha");
});
