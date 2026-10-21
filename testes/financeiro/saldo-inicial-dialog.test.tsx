// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("@/app/(protegido)/financeiro/bancario/actions", () => ({ editarSaldoInicialAction: vi.fn(), criarContaBancariaAction: vi.fn(), alternarAtivoContaBancariaAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/bancario/cartoes-actions", () => ({ salvarCartaoAction: vi.fn(), alternarCartaoAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { editarSaldoInicialAction } from "@/app/(protegido)/financeiro/bancario/actions";
import { ContasBancariasView } from "@/app/(protegido)/financeiro/bancario/contas-bancarias-view";

const conta = { id: "conta", nome: "Conta de teste", saldoInicial: 1200.50, dataSaldoInicial: "2026-09-10", ativo: true, saldoAtual: 1200.50 };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("oculta a edição para quem não é administrador", () => {
  render(<ContasBancariasView contas={[conta]} movimentacoesPorConta={{}} />);
  expect(screen.queryByRole("button", { name: "Editar saldo inicial" })).toBeNull();
});
it("preenche a base existente, envia valor/data somente ao salvar e mantém erros visíveis", async () => {
  vi.mocked(editarSaldoInicialAction).mockResolvedValueOnce({ erro: "Permissão revogada." }).mockResolvedValueOnce({ ok: true });
  const usuario = userEvent.setup();
  render(<ContasBancariasView contas={[conta]} movimentacoesPorConta={{}} podeEditarSaldo />);
  await usuario.click(screen.getByRole("button", { name: "Editar saldo inicial" }));
  const valor = screen.getByLabelText("Saldo inicial") as HTMLInputElement;
  expect(valor.value).toBe("1.200,50");
  expect((screen.getByLabelText("Data do saldo inicial") as HTMLInputElement).value).toBe("2026-09-10");
  expect(editarSaldoInicialAction).not.toHaveBeenCalled();
  await usuario.clear(valor);
  await usuario.type(valor, "2590");
  await usuario.click(screen.getByRole("combobox", { name: "Sinal do saldo" }));
  await usuario.click(await screen.findByRole("option", { name: "Negativo" }));
  await usuario.click(screen.getByRole("button", { name: "Salvar saldo inicial" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Permissão revogada.");
  const formulario = vi.mocked(editarSaldoInicialAction).mock.calls[0][1];
  expect(formulario.get("saldoInicial")).toBe("-25.90");
  expect(formulario.get("dataSaldoInicial")).toBe("2026-09-10");
  // O alerta pode aparecer antes de a transição liberar o botão para nova tentativa.
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar saldo inicial" })).toHaveProperty("disabled", false));
  await usuario.click(screen.getByRole("button", { name: "Salvar saldo inicial" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
