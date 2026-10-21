// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsumoCombobox } from "@/app/(protegido)/inventario/insumo-combobox";
import { FornecedorCombobox } from "@/app/(protegido)/compras/fornecedor-combobox";

const simulados = vi.hoisted(() => ({ salvarInsumo: vi.fn(), salvarFornecedor: vi.fn() }));
vi.mock("@/app/(protegido)/insumos/actions", () => ({ saveInsumoAction: simulados.salvarInsumo }));
vi.mock("@/app/(protegido)/fornecedores/actions", () => ({
  saveFornecedorAction: simulados.salvarFornecedor,
  salvarBeneficiarioAction: vi.fn(),
  createCanalPedidoAction: vi.fn(),
  createFormaPagamentoAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  simulados.salvarInsumo.mockResolvedValue({
    error: null,
    insumoId: "insumo-novo",
    insumo: { id: "insumo-novo", nome: "QUEIJO NOVO", unidade: "KG", custoMedio: 0, categoriaId: null, fornecedorPrincipalId: "fornecedor", fornecedorIds: ["fornecedor"] },
  });
  simulados.salvarFornecedor.mockResolvedValue({ error: null, fornecedor: { id: "fornecedor-novo", nome: "CASA NOVA" } });
});
afterEach(cleanup);

it("cadastra e seleciona um insumo sem sair do seletor", async () => {
  const usuario = userEvent.setup();
  const aoMudar = vi.fn();
  render(<InsumoCombobox insumos={[]} value={null} onChange={aoMudar} podeCadastrar fornecedorIdNovo="fornecedor" />);
  await usuario.click(screen.getByRole("button", { name: "Cadastrar novo insumo" }));
  await usuario.type(screen.getByLabelText("Nome *"), "Queijo novo");
  await usuario.click(screen.getByRole("combobox", { name: "Unidade principal do novo insumo" }));
  await usuario.click(await screen.findByRole("option", { name: /Quilograma/ }));
  await usuario.click(screen.getByRole("button", { name: "Cadastrar insumo" }));
  await waitFor(() => expect(aoMudar).toHaveBeenCalledWith("insumo-novo"));
  expect(simulados.salvarInsumo).toHaveBeenCalledWith({ error: null }, expect.any(FormData));
});

it("cadastra e seleciona um fornecedor sem abandonar o pedido", async () => {
  const usuario = userEvent.setup();
  const aoMudar = vi.fn();
  render(<FornecedorCombobox fornecedores={[]} value={null} onChange={aoMudar} podeCadastrar />);
  await usuario.click(screen.getByRole("button", { name: "Cadastrar novo fornecedor" }));
  await usuario.type(screen.getByLabelText("Nome *"), "Casa nova");
  await usuario.click(screen.getByRole("button", { name: "Cadastrar fornecedor" }));
  await waitFor(() => expect(aoMudar).toHaveBeenCalledWith("fornecedor-novo"));
});
