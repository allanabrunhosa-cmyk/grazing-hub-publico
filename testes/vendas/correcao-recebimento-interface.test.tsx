// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ corrigir: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ corrigirRecebimentoPedidoAction: sim.corrigir }));
import { CorrecaoRecebimento } from "@/app/(protegido)/vendas/pedidos/correcao-recebimento";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("exige justificativa e confirmação; preserva rascunho e chave após conflito", async () => {
  sim.corrigir.mockResolvedValue({ erro: "Desfaça a conciliação no Financeiro" });
  render(<CorrecaoRecebimento pedidoId="p" tituloId="t" revisao="2026-10-02" valor="90" />); const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Corrigir registro de recebimento" }));
  expect((screen.getByRole("button", { name: "Confirmar correção" }) as HTMLButtonElement).disabled).toBe(true);
  await u.type(screen.getByLabelText("Justificativa da correção"), "Registro fictício duplicado"); expect(sim.corrigir).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Confirmar correção" })); expect((await screen.findByRole("alert")).textContent).toContain("conciliação");
  expect((screen.getByLabelText("Justificativa da correção") as HTMLInputElement).value).toBe("Registro fictício duplicado");
  await u.click(screen.getByRole("button", { name: "Confirmar correção" })); expect(sim.corrigir.mock.calls[0]).toEqual(sim.corrigir.mock.calls[1]);
});
