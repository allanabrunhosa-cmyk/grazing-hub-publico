// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const sim = vi.hoisted(() => ({ executar: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.refresh }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ executarOperacaoPedidoAction: sim.executar }));
import { ApontamentosPedido } from "@/app/(protegido)/vendas/pedidos/apontamentos-pedido";
const props = { id: "p", versao: 4, status: "CONFIRMADO", estado: "EM_PREPARO", preparar: true, expedir: false, itens: [{ id: "i", quantidade: "4", unidadeSnapshot: "UN", produtoSnapshot: { nome: "Caixa fictícia" } }, { id: "j", quantidade: "3.5", unidadeSnapshot: "KG", produtoSnapshot: { nome: "Produto fracionado" } }], historico: [] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("preserva erro, chave de repetição e outro item; nunca aponta ao perder foco", async () => {
  sim.executar.mockResolvedValueOnce({ erro: "Saldo insuficiente" }).mockResolvedValue({ ok: true });
  const { rerender } = render(<ApontamentosPedido {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir Preparo e expedição por item" }));
  const a = screen.getByLabelText("Quantidade adicional de Caixa fictícia"), b = screen.getByLabelText("Quantidade adicional de Produto fracionado");
  fireEvent.change(a, { target: { value: "2" } }); fireEvent.change(b, { target: { value: "1,25" } }); fireEvent.blur(a);
  expect(sim.executar).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Registrar preparo" })[0]);
  expect((await screen.findByRole("alert")).textContent).toContain("Saldo insuficiente");
  expect((a as HTMLInputElement).value).toBe("2");
  fireEvent.click(screen.getAllByRole("button", { name: "Registrar preparo" })[0]);
  await waitFor(() => expect(sim.refresh).toHaveBeenCalledOnce());
  expect(sim.executar.mock.calls[0]).toEqual(sim.executar.mock.calls[1]);
  expect(sim.executar.mock.calls[0][2]).toEqual({ tipo: "PREPARAR", itemId: "i", quantidade: "2" });
  rerender(<ApontamentosPedido {...props} versao={5} />);
  expect((a as HTMLInputElement).value).toBe(""); expect((b as HTMLInputElement).value).toBe("1,25");
});
it("separa permissão de preparo e expedição e acompanha estado atualizado", () => {
  const { rerender } = render(<ApontamentosPedido {...props} estado="PRONTO" />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir Preparo e expedição por item" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  rerender(<ApontamentosPedido {...props} estado="PRONTO" expedir />);
  expect(screen.getAllByRole("button", { name: "Registrar expedição" })).toHaveLength(2);
  rerender(<ApontamentosPedido {...props} estado="ENTREGUE" expedir />);
  expect(screen.queryByRole("textbox")).toBeNull();
});
