// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ preparar: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.refresh }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/ifood/actions", () => ({ prepararAcompanhamentoIfoodAction: sim.preparar }));
import { AcompanhamentoConfigIfood } from "@/app/(protegido)/vendas/pedidos/ifood/acompanhamento-config";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function preencher() {
  render(<AcompanhamentoConfigIfood lojaId="loja-sintetica" ativa={false} />);
  fireEvent.click(screen.getByText("Preparar acompanhamento temporário"));
  fireEvent.change(screen.getByLabelText("Client ID do sistema principal (identificador público)"), { target: { value: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } });
  fireEvent.change(screen.getByLabelText("Referência da orientação sobre enquadramento"), { target: { value: "ENQUADRAMENTO-SINTETICO" } });
  fireEvent.change(screen.getByLabelText("Referência da orientação sobre presença"), { target: { value: "PRESENCA-SINTETICA" } });
  fireEvent.change(screen.getByLabelText("Janela do piloto (minutos)"), { target: { value: "1" } });
  return screen.getByRole("button", { name: "Preparar acompanhamento pausado" });
}
describe("Preparação de nova janela de acompanhamento", () => {
  it("nova preparação após sucesso usa nova chave, inclusive com os mesmos campos", async () => {
    sim.preparar.mockResolvedValue({ ok: true }); const botao = preencher();
    await act(async () => fireEvent.click(botao)); const primeira = sim.preparar.mock.calls[0][1];
    await act(async () => fireEvent.click(botao)); const segunda = sim.preparar.mock.calls[1][1];
    expect(primeira.minutos).toBe(1); expect(primeira).not.toHaveProperty("ate"); expect(segunda.minutos).toBe(1);
    expect(segunda.chave).not.toBe(primeira.chave); expect(sim.refresh).toHaveBeenCalledTimes(2);
  });
  it("resultado incerto conserva chave e duração para retry sem estender a janela", async () => {
    sim.preparar.mockRejectedValueOnce(new Error("Resposta perdida sintética")).mockResolvedValue({ ok: true }); const botao = preencher();
    await act(async () => fireEvent.click(botao)); const primeira = sim.preparar.mock.calls[0][1];
    expect(screen.getByRole("status").textContent).toContain("Resultado não confirmado"); expect(sim.refresh).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(botao)); expect(sim.preparar.mock.calls[1][1]).toEqual(primeira); expect(sim.refresh).toHaveBeenCalledTimes(1);
  });
});
