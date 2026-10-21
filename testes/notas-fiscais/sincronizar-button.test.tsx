// @vitest-environment jsdom
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SincronizarButton } from "@/app/(protegido)/notas-fiscais/sincronizar-button";
import { buscarNotasPelaApi } from "@/lib/notas-fiscais/api-cliente";
import { toast } from "sonner";

vi.mock("@/lib/notas-fiscais/api-cliente", () => ({ buscarNotasPelaApi: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));

class LimiteErro extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() { return this.state.falhou ? <p>A página caiu</p> : this.props.children; }
}

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("buscar novas notas", () => {
  it("mantém a página e orienta atualizar quando a comunicação falha, sem repetir a consulta", async () => {
    vi.mocked(buscarNotasPelaApi).mockRejectedValue(new Error("Failed to fetch"));
    render(<LimiteErro><SincronizarButton /><p>Lista de notas preservada</p></LimiteErro>);
    await userEvent.click(screen.getByRole("button", { name: "Buscar novas notas" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível receber o resultado da busca.",
      expect.objectContaining({ description: expect.stringContaining("Atualize a página"), duration: 12000 }),
    ));
    expect(screen.queryByText("A página caiu")).toBeNull();
    expect(screen.getByText("Lista de notas preservada")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Buscar novas notas" }) as HTMLButtonElement).disabled).toBe(false));
    expect(buscarNotasPelaApi).toHaveBeenCalledTimes(1);
  });

  it("preserva a mensagem de erro devolvida pelo servidor", async () => {
    vi.mocked(buscarNotasPelaApi).mockResolvedValue({ erro: "Sua sessão expirou. Entre novamente." });
    render(<SincronizarButton />);
    await userEvent.click(screen.getByRole("button", { name: "Buscar novas notas" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sua sessão expirou. Entre novamente."));
  });

  it("confirma a fila sem afirmar que as notas já foram consultadas", async () => {
    vi.mocked(buscarNotasPelaApi).mockResolvedValue({
      agendada: true, mensagem: "Aguarde o intervalo da SEFAZ.",
    });
    render(<SincronizarButton />);
    await userEvent.click(screen.getByRole("button", { name: "Buscar novas notas" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Busca agendada", expect.objectContaining({ description: "Aguarde o intervalo da SEFAZ." })));
    expect(toast.error).not.toHaveBeenCalled();
    expect(buscarNotasPelaApi).toHaveBeenCalledTimes(1);
  });
});
