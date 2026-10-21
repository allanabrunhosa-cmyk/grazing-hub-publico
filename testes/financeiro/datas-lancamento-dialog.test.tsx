// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({ criarLancamentoAction: vi.fn(), atualizarLancamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/fornecedores/fornecedor-dialog", () => ({ FornecedorDialog: () => null }));
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";
afterEach(cleanup);
it("impede salvar ano 0206 e conserva a digitação para correção sem fechar o formulário", () => {
  render(<LancamentoDialog categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Novo Lançamento" }));
  const dialogo = screen.getByRole("dialog");
  const competencia = dialogo.querySelector<HTMLInputElement>('input[name="dataCompetencia"]')!;
  const vencimento = dialogo.querySelector<HTMLInputElement>('input[name="dataVencimento"]')!;
  fireEvent.change(competencia, { target: { value: "2026-09-30" } });
  fireEvent.change(vencimento, { target: { value: "0206-10-10" } });
  expect(vencimento.validity.rangeUnderflow).toBe(true);
  expect(vencimento.checkValidity()).toBe(false);
  expect(vencimento.value).toBe("0206-10-10");
  expect(competencia.value).toBe("2026-09-30");
  fireEvent.change(vencimento, { target: { value: "2026-10-10" } });
  expect(vencimento.checkValidity()).toBe(true);
  expect(screen.getByRole("dialog")).toBeTruthy();
});
it("não gera parcelas com ano incompleto e recupera a prévia quando a data é corrigida", () => {
  render(<LancamentoDialog categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Novo Lançamento" }));
  const dialogo = screen.getByRole("dialog");
  const vencimento = dialogo.querySelector<HTMLInputElement>('input[name="dataVencimento"]')!;
  fireEvent.change(vencimento, { target: { value: "2026-10-10" } });
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });
  expect(screen.getByText("Vencimentos das parcelas (ajuste fino, se precisar)")).toBeTruthy();
  fireEvent.change(vencimento, { target: { value: "0206-10-10" } });
  expect(screen.queryByText("Vencimentos das parcelas (ajuste fino, se precisar)")).toBeNull();
  fireEvent.change(vencimento, { target: { value: "2026-10-10" } });
  expect(screen.getByText("Vencimentos das parcelas (ajuste fino, se precisar)")).toBeTruthy();
});
