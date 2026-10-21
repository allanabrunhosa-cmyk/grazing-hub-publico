// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConciliacaoFornecedor } from "@/app/(protegido)/notas-fiscais/conciliacao-fornecedor";
import { prepararConciliacaoFornecedorAction, conciliarFornecedorNotaAction } from "@/app/(protegido)/notas-fiscais/conciliar-fornecedor-actions";
import { prepararConciliacaoFornecedorAction as previaVisual } from "../visual/fornecedor-nota-acoes";
vi.mock("@/app/(protegido)/notas-fiscais/conciliar-fornecedor-actions", () => ({ prepararConciliacaoFornecedorAction: vi.fn(), conciliarFornecedorNotaAction: vi.fn() }));
// O cadastro aninhado não é exercitado aqui; suas Server Actions não podem carregar
// Prisma/sessão reais no teste de interface.
vi.mock("@/app/(protegido)/fornecedores/actions", () => ({ saveFornecedorAction: vi.fn(), createCanalPedidoAction: vi.fn(), createFormaPagamentoAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.mocked(prepararConciliacaoFornecedorAction).mockResolvedValue(await previaVisual("nota"));
  vi.mocked(conciliarFornecedorNotaAction).mockResolvedValue({ fornecedor: { id: "fornecedor-visual", nome: "Laticínios Serra", memorizado: true } });
});
afterEach(cleanup);
it("só grava após conferir, permite preservar um campo e devolve o vínculo sem apagar o formulário da nota", async () => {
  const usuario = userEvent.setup(), onConciliado = vi.fn(), onOcupado = vi.fn();
  render(<ConciliacaoFornecedor notaId="nota" fornecedor={null} bloqueado={false} onConciliado={onConciliado} onOcupado={onOcupado} />);
  expect(conciliarFornecedorNotaAction).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Conciliar fornecedor" }));
  await usuario.click(await screen.findByRole("checkbox", { name: /Telefone/ }));
  await usuario.click(screen.getByRole("button", { name: "Salvar conciliação" }));
  expect(conciliarFornecedorNotaAction).toHaveBeenCalledWith(expect.objectContaining({ campos: ["razaoSocial", "cnpj"], fornecedorId: "fornecedor-visual" }));
  expect(onConciliado).toHaveBeenCalledWith(expect.objectContaining({ memorizado: true }));
  expect(onOcupado.mock.calls).toEqual([[true], [false]]);
});
it("mantém a conferência com mensagem de erro e pede atualização quando o cadastro mudou", async () => {
  const usuario = userEvent.setup();
  vi.mocked(conciliarFornecedorNotaAction).mockResolvedValue({ erro: "O cadastro mudou. Reabra a conferência." });
  render(<ConciliacaoFornecedor notaId="nota" fornecedor={null} bloqueado={false} onConciliado={vi.fn()} onOcupado={vi.fn()} />);
  await usuario.click(screen.getByRole("button", { name: "Conciliar fornecedor" }));
  await usuario.click(await screen.findByRole("button", { name: "Salvar conciliação" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "O cadastro mudou. Reabra a conferência.");
  expect(screen.getByRole("button", { name: "Salvar conciliação" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Reabrir conferência" })).toBeTruthy();
});
