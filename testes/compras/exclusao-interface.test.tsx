// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PedidosView } from "@/app/(protegido)/compras/pedidos-view";
import { PedidosCalendario } from "@/app/(protegido)/compras/pedidos-calendario";
import { dataISO } from "@/app/(protegido)/compras/calendario";
import type { PedidoRow } from "@/app/(protegido)/compras/types";
vi.mock("server-only", () => ({}));
const { excluir } = vi.hoisted(() => ({ excluir: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/app/(protegido)/compras/actions", () => ({ excluirPedidoAction: excluir, salvarPedidoAction: vi.fn(), confirmarRecebimentoAction: vi.fn(), reabrirPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/compras/reagendar-pedido", () => ({ reagendarPedidoAction: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const pedido: PedidoRow = { id: "teste", numero: 99, fornecedorId: null, fornecedorNome: "Fornecedor do teste", dataPedido: new Date().toISOString(), previsaoEntrega: dataISO(new Date()) + "T12:00:00Z", status: "RECEBIDO_TOTAL", temDivergencia: true, observacoes: null, recebimentos: [], itens: [{ id: "item", insumoId: null, insumoNome: "Item preservado", quantidade: 3, unidadeCompra: "UN", precoUnitario: 10, precoTotal: 30 }] };

it("confirma exclusão, oculta nas visões ativas e mantém detalhes no histórico sem ações de alteração", async () => {
  const usuario = userEvent.setup();
  render(<PedidosView pedidos={[pedido]} fornecedores={[]} insumos={[]} cotacoes={[]} />);
  await usuario.click(screen.getByText(pedido.fornecedorNome));
  expect(screen.queryByRole("button", { name: "Cancelar pedido" })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Excluir pedido" }));
  expect(excluir).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
  await waitFor(() => expect(excluir).toHaveBeenCalledWith(pedido.id));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByText(pedido.fornecedorNome)).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Calendário" }));
  expect(screen.queryByRole("button", { name: /#0099 —/ })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Lista" }));
  await usuario.click(screen.getByRole("button", { name: /^Recebido \(\d[\d.]*\)$/ }));
  expect(screen.queryByText(pedido.fornecedorNome)).toBeNull();
  await usuario.click(screen.getByRole("button", { name: /^Excluídos \(\d[\d.]*\)$/ }));
  await usuario.click(screen.getByText(pedido.fornecedorNome));
  expect(screen.getByText("Item preservado", { exact: true })).toBeDefined();
  expect(screen.getByText(/Disponível somente para consulta/)).toBeDefined();
  expect(screen.queryByRole("button", { name: "Excluir pedido" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Reabrir pedido" })).toBeNull();
});

it("renderiza todos os pedidos do dia em linhas compactas e abre também o último", async () => {
  const usuario = userEvent.setup(), selecionar = vi.fn();
  const pedidos = Array.from({ length: 12 }, (_, i) => ({ ...pedido, id: String(i), numero: 100 + i }));
  render(<PedidosCalendario pedidos={pedidos} onSelecionar={selecionar} />);
  expect(screen.queryByText("Item preservado", { exact: false })).toBeNull();
  expect(screen.queryByRole("button", { name: /Ver todos/ })).toBeNull();
  expect(screen.getAllByRole("button", { name: /— Fornecedor do teste —/ })).toHaveLength(12);
  await usuario.click(screen.getByRole("button", { name: /#0111 —/ }));
  expect(selecionar).toHaveBeenCalledWith(pedidos[11]);
});
