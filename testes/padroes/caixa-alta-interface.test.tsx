// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";

vi.mock("@/app/(protegido)/fornecedores/actions", () => ({
  saveFornecedorAction: vi.fn(async () => ({ error: null })),
  salvarBeneficiarioAction: vi.fn(async () => ({ ok: true })),
  createCanalPedidoAction: vi.fn(),
  createFormaPagamentoAction: vi.fn(),
}));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({
  criarLancamentoAction: vi.fn(async () => ({ ok: true })),
  atualizarLancamentoAction: vi.fn(async () => ({ ok: true })),
}));

afterEach(cleanup);

describe("campos com preenchimento em caixa alta", () => {
  it("converte nome e razão social do fornecedor enquanto digita", async () => {
    const usuario = userEvent.setup();
    render(<FornecedorDialog canaisPedidoOptions={[]} formasPagamentoOptions={[]} trigger={<button type="button">Novo</button>} />);

    await usuario.click(screen.getByRole("button", { name: "Novo" }));
    const nome = await screen.findByLabelText("Nome *");
    const razaoSocial = screen.getByLabelText("Razão social");
    await usuario.type(nome, "Mercado São José");
    await usuario.type(razaoSocial, "Comércio de alimentos ltda");

    expect((nome as HTMLInputElement).value).toBe("MERCADO SÃO JOSÉ");
    expect((razaoSocial as HTMLInputElement).value).toBe("COMÉRCIO DE ALIMENTOS LTDA");
  });

  it("escolhe fornecedor ou beneficiário dentro do mesmo cadastro novo", async () => {
    const usuario = userEvent.setup();
    render(<FornecedorDialog canaisPedidoOptions={[]} formasPagamentoOptions={[]} trigger={<button type="button">Novo</button>} />);

    await usuario.click(screen.getByRole("button", { name: "Novo" }));
    expect(await screen.findByRole("heading", { name: "Novo cadastro" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Fornecedor/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Razão social")).toBeTruthy();

    await usuario.click(screen.getByRole("button", { name: /^Beneficiário/ }));
    expect(screen.getByRole("button", { name: /^Beneficiário/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("CPF ou CNPJ")).toBeTruthy();
    expect(screen.getByLabelText("Telefone")).toBeTruthy();
    expect(screen.queryByLabelText("Razão social")).toBeNull();
  });

  it("converte descrição e contraparte do lançamento enquanto digita", async () => {
    const usuario = userEvent.setup();
    render(<LancamentoDialog categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} trigger={<button type="button">Novo lançamento</button>} />);

    await usuario.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const descricao = await screen.findByPlaceholderText("Aluguel de setembro, venda do dia...");
    const contraparte = screen.getByPlaceholderText("Nome");
    await usuario.type(descricao, "Venda diária");
    await usuario.type(contraparte, "Cliente João");

    expect((descricao as HTMLInputElement).value).toBe("VENDA DIÁRIA");
    expect((contraparte as HTMLInputElement).value).toBe("CLIENTE JOÃO");
  });
});
