// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TratamentoOutraOperacaoNota } from "@/app/(protegido)/notas-fiscais/tratamento-outra-operacao";
import { tratarOutraOperacaoNotaAction } from "@/app/(protegido)/notas-fiscais/tratamento-local-actions";
import { notaTeste } from "./dados";

vi.mock("@/app/(protegido)/notas-fiscais/tratamento-local-actions", () => ({ tratarOutraOperacaoNotaAction: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_isUnrecognizedActionError: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const motivo = "Devolução do equipamento já realizada.";
beforeEach(() => { vi.resetAllMocks(); vi.mocked(tratarOutraOperacaoNotaAction).mockResolvedValue({ ok: true, versao: 1 }); });
afterEach(cleanup);

it("exige motivo e data efetiva, recusa futuro e mantém o formulário após erro", async () => {
  const usuario = userEvent.setup(); const concluido = vi.fn();
  render(<TratamentoOutraOperacaoNota nota={notaTeste} onOcupado={vi.fn()} onConcluido={concluido} />);
  await usuario.click(screen.getByRole("button", { name: "Registrar devolução/retorno" }));
  fireEvent.change(screen.getByLabelText("Motivo do tratamento (15 a 500 caracteres)"), { target: { value: motivo } });
  await usuario.click(screen.getByRole("button", { name: "Confirmar devolução/retorno" }));
  expect(screen.getByRole("alert").textContent).toContain("data de devolução válida");
  fireEvent.change(screen.getByLabelText("Data da devolução"), { target: { value: "9999-01-01" } });
  await usuario.click(screen.getByRole("button", { name: "Confirmar devolução/retorno" }));
  expect(screen.getByRole("alert").textContent).toContain("não pode ser futura");
  expect(tratarOutraOperacaoNotaAction).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Data da devolução"), { target: { value: "2024-02-29" } });
  vi.mocked(tratarOutraOperacaoNotaAction).mockResolvedValue({ erro: "Conflito: reabra o painel." });
  await usuario.click(screen.getByRole("button", { name: "Confirmar devolução/retorno" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Conflito: reabra o painel.");
  expect((screen.getByLabelText("Data da devolução") as HTMLInputElement).value).toBe("2024-02-29");
  expect((screen.getByLabelText("Motivo do tratamento (15 a 500 caracteres)") as HTMLTextAreaElement).value).toBe(motivo);
  expect(concluido).not.toHaveBeenCalled();
});

it("ignora sem data, com confirmação explícita e motivo limitado", async () => {
  const usuario = userEvent.setup(); const concluido = vi.fn();
  render(<TratamentoOutraOperacaoNota nota={notaTeste} onOcupado={vi.fn()} onConcluido={concluido} />);
  await usuario.click(screen.getByRole("button", { name: "Ignorar nota" }));
  expect(screen.getByText(/não envia manifestação à SEFAZ/)).toBeTruthy();
  expect(screen.queryByLabelText("Data da devolução")).toBeNull();
  const campo = screen.getByLabelText("Motivo do tratamento (15 a 500 caracteres)");
  expect(campo.getAttribute("maxlength")).toBe("500");
  fireEvent.change(campo, { target: { value: "Nota de equipamento\u0000 sem efeito de compra." } });
  expect((campo as HTMLTextAreaElement).value).not.toContain("\u0000");
  await usuario.click(screen.getByRole("button", { name: "Confirmar nota ignorada" }));
  await waitFor(() => expect(concluido).toHaveBeenCalledOnce());
  expect(tratarOutraOperacaoNotaAction).toHaveBeenCalledWith({ notaFiscalId: notaTeste.id, versao: 0, acao: "IGNORAR", motivo: "Nota de equipamento sem efeito de compra." });
});

it("reabre uma nota tratada com a revisão atual e preserva a manifestação fiscal", async () => {
  const usuario = userEvent.setup();
  render(<TratamentoOutraOperacaoNota nota={{ ...notaTeste, tratamentoLocal: "IGNORADA", tratamentoLocalVersao: 3, motivoTratamentoLocal: motivo }} onOcupado={vi.fn()} onConcluido={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Ignorar nota" })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Reabrir controle da nota" }));
  expect(screen.getByText(/manifestações já registradas na SEFAZ serão preservadas/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Motivo do tratamento (15 a 500 caracteres)"), { target: { value: "Conferência interna solicitada novamente." } });
  await usuario.click(screen.getByRole("button", { name: "Confirmar reabertura" }));
  expect(tratarOutraOperacaoNotaAction).toHaveBeenCalledWith(expect.objectContaining({ versao: 3, acao: "REABRIR" }));
});

it("bloqueia outra confirmação enquanto aguarda o resultado", async () => {
  vi.mocked(tratarOutraOperacaoNotaAction).mockImplementation(() => new Promise(() => {}));
  const usuario = userEvent.setup(); const ocupado = vi.fn();
  render(<TratamentoOutraOperacaoNota nota={notaTeste} onOcupado={ocupado} onConcluido={vi.fn()} />);
  await usuario.click(screen.getByRole("button", { name: "Ignorar nota" }));
  fireEvent.change(screen.getByLabelText("Motivo do tratamento (15 a 500 caracteres)"), { target: { value: motivo } });
  const confirmar = screen.getByRole("button", { name: "Confirmar nota ignorada" });
  await usuario.click(confirmar); await usuario.click(confirmar);
  expect((confirmar as HTMLButtonElement).disabled).toBe(true);
  expect(ocupado).toHaveBeenCalledWith(true);
  expect(tratarOutraOperacaoNotaAction).toHaveBeenCalledOnce();
});
