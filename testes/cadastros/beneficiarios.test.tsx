// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { documentoValidoOuVazio, formatarCpfCnpj } from "@/lib/documento-brasileiro";
import { fornecedorStatus } from "./dados";
import type { FornecedorRow } from "@/app/(protegido)/fornecedores/types";

vi.mock("@/app/(protegido)/status-cadastros-actions", () => ({ alterarStatusFornecedorAction: vi.fn() }));
vi.mock("@/app/(protegido)/fornecedores/fornecedor-actions-cell", () => ({ FornecedorActionsCell: () => null }));
vi.mock("@/app/(protegido)/fornecedores/fornecedor-detalhes", () => ({ FornecedorDetalhes: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(cleanup);

const beneficiario: FornecedorRow = {
  ...fornecedorStatus,
  id: "beneficiario",
  tipoCadastro: "BENEFICIARIO",
  nome: "Marina Oliveira",
  razaoSocial: null,
  cpf: "12345678901",
  telefone: "(11) 99999-1234",
  formasPagamento: [{ id: "pix", nome: "PIX" }],
  insumosVinculados: [],
};

describe("beneficiários", () => {
  it("formata CPF ou CNPJ automaticamente de acordo com a quantidade de números", () => {
    expect(formatarCpfCnpj("12345678901")).toBe("123.456.789-01");
    expect(formatarCpfCnpj("12345678000190")).toBe("12.345.678/0001-90");
    expect(documentoValidoOuVazio("")).toBe(true);
    expect(documentoValidoOuVazio("12345678901")).toBe(true);
    expect(documentoValidoOuVazio("123456789012")).toBe(false);
  });

  it("separa as abas, informa os ativos e exibe o cadastro simplificado", async () => {
    const usuario = userEvent.setup();
    render(
      <FornecedoresTable
        fornecedores={[fornecedorStatus, beneficiario, { ...beneficiario, id: "inativo", nome: "Inativo", cpf: "98765432100", ativo: false }]}
        canaisPedidoOptions={[]}
        formasPagamentoOptions={beneficiario.formasPagamento}
      />
    );

    expect(screen.getByRole("tab", { name: "Fornecedores (1)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Beneficiários (1)" })).toBeTruthy();
    expect(screen.getByText(fornecedorStatus.nome)).toBeTruthy();
    expect(screen.queryByText(beneficiario.nome)).toBeNull();

    await usuario.click(screen.getByRole("tab", { name: "Beneficiários (1)" }));
    expect(screen.getByText(beneficiario.nome)).toBeTruthy();
    expect(screen.getByText("123.456.789-01")).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /Marina Oliveira/ })).getByText("PIX")).toBeTruthy();
    expect(screen.queryByText(fornecedorStatus.nome)).toBeNull();
  });
});
