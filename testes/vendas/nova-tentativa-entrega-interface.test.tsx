// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ executar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ executarOperacaoPedidoAction: sim.executar }));
import { NovaTentativaEntrega } from "@/app/(protegido)/vendas/pedidos/nova-tentativa-entrega";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("só envia após conferência explícita, preserva justificativa no erro e repete a mesma chave", async () => {
  sim.executar.mockResolvedValue({ erro: "Resolva os destinos pendentes antes da nova saída" });
  render(<NovaTentativaEntrega id="p" versao={4} ocorrenciaId="falha" />);
  const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Nova tentativa de entrega" }));
  await u.type(screen.getByLabelText("Condição, guarda e responsável pelos produtos"), "Produtos íntegros sob guarda do entregador fictício");
  expect(screen.getByRole("button", { name: "Registrar nova saída" }).hasAttribute("disabled")).toBe(true);
  expect(sim.executar).not.toHaveBeenCalled();
  await u.click(screen.getByRole("checkbox"));
  await u.click(screen.getByRole("button", { name: "Registrar nova saída" }));
  expect((await screen.findByRole("alert")).textContent).toContain("destinos pendentes");
  expect((screen.getByLabelText("Condição, guarda e responsável pelos produtos") as HTMLInputElement).value).toContain("íntegros");
  await u.click(screen.getByRole("button", { name: "Registrar nova saída" }));
  expect(sim.executar.mock.calls[0]).toEqual(sim.executar.mock.calls[1]);
  expect(sim.executar.mock.calls[0][2]).toMatchObject({ tipo: "NOVA_TENTATIVA", ocorrenciaId: "falha", conferenciaMaterial: true });
});
