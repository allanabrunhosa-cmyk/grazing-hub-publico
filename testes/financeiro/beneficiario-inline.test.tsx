// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";

const simulados = vi.hoisted(() => ({
  salvarBeneficiario: vi.fn(async () => ({
    ok: true as const,
    beneficiario: { id: "beneficiario-novo", nome: "MARIA SILVA", formaPagamentoId: "pix" },
  })),
}));

vi.mock("@/app/(protegido)/fornecedores/actions", () => ({
  salvarBeneficiarioAction: simulados.salvarBeneficiario,
  saveFornecedorAction: vi.fn(),
  createCanalPedidoAction: vi.fn(),
  createFormaPagamentoAction: vi.fn(),
}));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({
  criarLancamentoAction: vi.fn(),
  atualizarLancamentoAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("cadastra e seleciona um beneficiário sem fechar o novo lançamento", async () => {
  const usuario = userEvent.setup();
  render(
    <LancamentoDialog
      categorias={[]}
      fornecedores={[]}
      formasPagamento={[{ id: "pix", nome: "PIX" }]}
      contasBancarias={[]}
      podeCadastrarBeneficiario
      trigger={<button type="button">Novo lançamento</button>}
    />
  );

  await usuario.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await usuario.click(screen.getByRole("button", { name: "Cadastrar fornecedor ou beneficiário" }));
  await usuario.click(screen.getByRole("button", { name: "Beneficiário Pagamentos e lançamentos financeiros" }));
  await usuario.type(screen.getByLabelText("Nome *"), "Maria Silva");
  await usuario.click(screen.getByRole("button", { name: "Cadastrar beneficiário" }));

  await waitFor(() => expect(simulados.salvarBeneficiario).toHaveBeenCalledOnce());
  expect(screen.getByRole("heading", { name: "Novo Lançamento" })).toBeDefined();
  expect(screen.getByText("MARIA SILVA")).toBeDefined();
  expect(screen.getByText("PIX")).toBeDefined();
});

it("oculta o cadastro rápido quando o usuário não tem permissão", async () => {
  const usuario = userEvent.setup();
  render(
    <LancamentoDialog
      categorias={[]}
      fornecedores={[]}
      formasPagamento={[]}
      contasBancarias={[]}
      trigger={<button type="button">Novo lançamento</button>}
    />
  );

  await usuario.click(screen.getByRole("button", { name: "Novo lançamento" }));
  expect(screen.queryByRole("button", { name: "Cadastrar fornecedor ou beneficiário" })).toBeNull();
});
