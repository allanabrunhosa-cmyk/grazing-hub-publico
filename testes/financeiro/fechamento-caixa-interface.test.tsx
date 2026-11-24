// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FechamentoCaixaControle } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fechamento-controle";
import { fixarHojeDoFluxo } from "./relogio-fluxo";
fixarHojeDoFluxo("2026-11-24");
afterEach(cleanup);

const historico = [{ id: "f1", mes: "2026-09", fechadoEm: "2026-10-02T12:00:00Z", fechadoPorNome: "Administradora fictícia", reabertoEm: null, reabertoPorNome: null, motivoReabertura: null }];

it("sem gestão mostra somente a situação do fechamento", () => {
  render(<FechamentoCaixaControle fechadoAte="2026-09-30" historico={historico} podeGerir={false} fechar={vi.fn()} reabrir={vi.fn()} />);
  expect(screen.getByText(/fechado até 30\/09\/2026/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Fechar mês" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Reabrir mês" })).toBeNull();
});

it("administrador fecha o mês anterior por padrão e só meses encerrados após o último fechamento", async () => {
  const usuario = userEvent.setup();
  const fechar = vi.fn().mockResolvedValue({ ok: true, fechadoAte: "2026-10-31" });
  render(<FechamentoCaixaControle fechadoAte="2026-09-30" historico={historico} podeGerir fechar={fechar} reabrir={vi.fn()} />);
  await usuario.click(screen.getByRole("button", { name: "Fechar mês" }));
  const dialogo = screen.getByRole("dialog");
  const campo = within(dialogo).getByLabelText("Mês a fechar") as HTMLInputElement;
  expect(campo.value).toBe("2026-10");
  expect(within(dialogo).getByText(/fechado por Administradora fictícia em 02\/10\/2026/)).toBeTruthy();
  const confirmar = within(dialogo).getByRole("button", { name: "Fechar mês" }) as HTMLButtonElement;
  for (const invalido of ["2026-11", "2026-09", "2026-08"]) {
    fireEvent.change(campo, { target: { value: invalido } });
    expect(confirmar.disabled).toBe(true);
  }
  fireEvent.change(campo, { target: { value: "2026-10" } });
  await usuario.click(confirmar);
  await waitFor(() => expect(fechar).toHaveBeenCalledWith("2026-10"));
});

it("reabertura exige motivo e mostra a recusa do servidor", async () => {
  const usuario = userEvent.setup();
  const reabrir = vi.fn().mockResolvedValue({ erro: "Somente administradores fecham ou reabrem o mês do fluxo de caixa." });
  render(<FechamentoCaixaControle fechadoAte="2026-09-30" historico={historico} podeGerir fechar={vi.fn()} reabrir={reabrir} />);
  await usuario.click(screen.getByRole("button", { name: "Reabrir mês" }));
  const dialogo = screen.getByRole("dialog");
  expect(within(dialogo).getByText("Reabrir setembro de 2026?")).toBeTruthy();
  const confirmar = within(dialogo).getByRole("button", { name: "Reabrir mês" }) as HTMLButtonElement;
  expect(confirmar.disabled).toBe(true);
  await usuario.type(within(dialogo).getByLabelText("Motivo da reabertura"), "Corrigir baixa do mês");
  await usuario.click(confirmar);
  await waitFor(() => expect(reabrir).toHaveBeenCalledWith("Corrigir baixa do mês"));
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("sem fechamento não oferece reabertura", () => {
  render(<FechamentoCaixaControle fechadoAte={null} historico={[]} podeGerir fechar={vi.fn()} reabrir={vi.fn()} />);
  expect(screen.getByText(/Nenhum mês fechado/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Reabrir mês" })).toBeNull();
});
