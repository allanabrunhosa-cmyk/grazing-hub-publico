// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";
import type { FornecedorRow } from "@/app/(protegido)/fornecedores/types";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

vi.mock("@/app/(protegido)/status-cadastros-actions", () => ({ alterarStatusFornecedorAction: vi.fn() }));
vi.mock("@/app/(protegido)/fornecedores/actions", () => ({
  saveFornecedorAction: vi.fn(), deleteFornecedorAction: vi.fn(),
  salvarBeneficiarioAction: vi.fn(), excluirBeneficiarioAction: vi.fn(),
  createCanalPedidoAction: vi.fn(), createFormaPagamentoAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const insumos = [
  { id: "queijo", nome: "Queijo brie", especificacao: "Peça de 1 kg" },
  { id: "farinha", nome: "Farinha de trigo", especificacao: "Tipo 1, força W300" },
];
const fornecedor: FornecedorRow = {
  id: "fornecedor-ficticio", tipoCadastro: "FORNECEDOR", nome: "Distribuidora Exemplo", razaoSocial: null,
  cnpj: null, cpf: null, contatoNome: null, email: null, telefone: null, site: null,
  prazoPagamentoDias: null, prazoEntregaDias: null, observacoes: null, ativo: true,
  createdAt: new Date("2026-01-01T12:00:00Z"), updatedAt: new Date("2026-01-01T12:00:00Z"),
  canaisPedido: [], formasPagamento: [], insumosVinculados: insumos,
};
const Administrador = ({ children }: { children: ReactNode }) => (
  <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>{children}</ProvedorAcesso>
);
const tabela = (cadastro: FornecedorRow) => (
  <FornecedoresTable fornecedores={[cadastro]} canaisPedidoOptions={[]} formasPagamentoOptions={[]} />
);
const formulario = (cadastro: FornecedorRow) => (
  <FornecedorDialog fornecedor={cadastro} canaisPedidoOptions={[]} formasPagamentoOptions={[]}
    trigger={<Button type="button">Editar fornecedor fictício</Button>} />
);

it("atualiza os insumos nos detalhes da lista aberta quando recebe os vínculos atuais", async () => {
  const usuario = userEvent.setup();
  const { rerender } = render(tabela(fornecedor), { wrapper: Administrador });
  await usuario.click(screen.getByRole("button", { name: "Abrir detalhes de Distribuidora Exemplo" }));
  const detalhes = within(screen.getByRole("region", { name: "Detalhes de Distribuidora Exemplo" }));
  expect(detalhes.getByText("Insumos vinculados")).toBeTruthy();
  expect(detalhes.getByText("Queijo brie")).toBeTruthy();
  expect(detalhes.getByText("Peça de 1 kg")).toBeTruthy();

  rerender(tabela({ ...fornecedor, insumosVinculados: [insumos[1]] }));
  expect(detalhes.queryByText("Queijo brie")).toBeNull();
  expect(detalhes.queryByText("Peça de 1 kg")).toBeNull();
  expect(detalhes.getByText("Farinha de trigo")).toBeTruthy();
  expect(detalhes.getByText("Tipo 1, força W300")).toBeTruthy();

  rerender(tabela({ ...fornecedor, insumosVinculados: [] }));
  expect(detalhes.queryByText("Farinha de trigo")).toBeNull();
  expect(detalhes.queryByText("Tipo 1, força W300")).toBeNull();
  expect(detalhes.getByText("Insumos vinculados")).toBeTruthy();
});

it("atualiza nomes, especificações e contagem no formulário aberto até não haver vínculos ativos", async () => {
  const usuario = userEvent.setup();
  const { rerender } = render(formulario(fornecedor));
  await usuario.click(screen.getByRole("button", { name: "Editar fornecedor fictício" }));
  const dialogo = within(await screen.findByRole("dialog", { name: "Editar fornecedor" }));
  expect(dialogo.getByText("Insumos vinculados (2)")).toBeTruthy();
  expect(dialogo.getByText("Peça de 1 kg")).toBeTruthy();
  expect(dialogo.getByText("Tipo 1, força W300")).toBeTruthy();

  const atualizado = { ...insumos[1], nome: "Farinha de trigo especial", especificacao: "Tipo 1, força W350" };
  rerender(formulario({ ...fornecedor, insumosVinculados: [atualizado] }));
  expect(dialogo.getByText("Insumos vinculados (1)")).toBeTruthy();
  expect(dialogo.queryByText("Queijo brie")).toBeNull();
  expect(dialogo.queryByText("Peça de 1 kg")).toBeNull();
  expect(dialogo.queryByText("Farinha de trigo")).toBeNull();
  expect(dialogo.queryByText("Tipo 1, força W300")).toBeNull();
  expect(dialogo.getByText(atualizado.nome)).toBeTruthy();
  expect(dialogo.getByText(atualizado.especificacao)).toBeTruthy();

  rerender(formulario({ ...fornecedor, insumosVinculados: [] }));
  expect(dialogo.getByText("Insumos vinculados (0)")).toBeTruthy();
  expect(dialogo.queryByText(atualizado.nome)).toBeNull();
  expect(dialogo.getByText("Nenhum insumo ativo vinculado a este fornecedor.")).toBeTruthy();
});

it("explica o estado vazio de um fornecedor sem insumos ativos vinculados", async () => {
  render(formulario({ ...fornecedor, insumosVinculados: [] }));
  await userEvent.click(screen.getByRole("button", { name: "Editar fornecedor fictício" }));
  const dialogo = within(await screen.findByRole("dialog", { name: "Editar fornecedor" }));
  expect(dialogo.getByText("Insumos vinculados (0)")).toBeTruthy();
  expect(dialogo.getByText("Nenhum insumo ativo vinculado a este fornecedor.")).toBeTruthy();
  expect(dialogo.queryByText(/fornecedor como principal/)).toBeNull();
});
