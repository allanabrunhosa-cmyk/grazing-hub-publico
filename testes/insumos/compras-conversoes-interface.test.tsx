// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PedidoDialog } from "@/app/(protegido)/compras/pedido-dialog";
import type { PedidoRow } from "@/app/(protegido)/compras/types";
vi.mock("server-only", () => ({}));
const simulados = vi.hoisted(() => ({ salvar: vi.fn().mockResolvedValue({ ok: true, pedidoId: "pedido" }) }));
vi.mock("@/app/(protegido)/compras/actions", () => ({ salvarPedidoAction: simulados.salvar }));
afterEach(cleanup);
const insumo = { id: "acucar", nome: "Açúcar", unidade: "KG" as const, custoMedio: 5, fornecedorPrincipalId: null, fornecedorIds: [], conversoes: [{ unidade: "FD" as const, fator: 10 }] };

it("converte preço e exibe o total sem trocar a quantidade comprada em fardos", async () => {
  const usuario = userEvent.setup();
  render(<PedidoDialog open onOpenChange={vi.fn()} fornecedores={[]} insumos={[insumo]} cotacoes={[]} />);
  await usuario.click(screen.getByRole("checkbox", { name: "Fornecedor não cadastrado" }));
  await usuario.click(screen.getByLabelText("Nome do fornecedor avulso"));
  await usuario.paste("Armazém");
  await usuario.click(screen.getByPlaceholderText("Buscar insumo..."));
  await usuario.click(await screen.findByRole("option", { name: "Açúcar" }));
  await usuario.type(screen.getByLabelText("Quantidade"), "2");
  await usuario.click(screen.getByLabelText("Unidade de compra"));
  await usuario.click(screen.getByRole("option", { name: "Fardo (fd) · 1 fd = 10 kg" }));
  expect((screen.getByLabelText("Preço unitário") as HTMLInputElement).value).toBe("50,00");
  expect(screen.getByText(/Total: 20 kg/)).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Criar pedido" }));
  await waitFor(() => expect(simulados.salvar).toHaveBeenCalledWith(expect.objectContaining({ itens: [expect.objectContaining({ quantidade: 2, unidadeCompra: "FD", precoUnitario: 50, conversao: { fator: 10, unidadePrincipal: "KG" } })] })));
});

it("mantém o fator histórico ao editar um pedido com cadastro já alterado", async () => {
  const pedido: PedidoRow = { id: "pedido", numero: 1, fornecedorId: null, fornecedorAvulso: "Armazém", fornecedorNome: "Armazém", dataPedido: "2026-09-10T12:00:00Z", previsaoEntrega: null, status: "CONFIRMADO", observacoes: null, recebimentos: [], temDivergencia: false,
    itens: [{ id: "item-original", insumoId: "acucar", insumoNome: "Açúcar", unidadeCompra: "FD", quantidade: 2, precoUnitario: 50, precoTotal: 100, fatorConversao: 10, unidadePrincipal: "KG" }] };
  const usuario = userEvent.setup();
  render(<PedidoDialog pedido={pedido} open onOpenChange={vi.fn()} fornecedores={[]} insumos={[{ ...insumo, conversoes: [{ unidade: "FD", fator: 12 }] }]} cotacoes={[]} />);
  expect(screen.getByText(/Conversão do pedido: 1 fd = 10 kg/)).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: /^Salvar$/ }));
  await waitFor(() => expect(simulados.salvar).toHaveBeenCalledWith(expect.objectContaining({ itens: [expect.objectContaining({ pedidoItemOriginalId: "item-original", conversao: { fator: 10, unidadePrincipal: "KG" } })] })));
});
