// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CobrancaClientePedido } from "@/app/(protegido)/vendas/pedidos/cadastro-cliente-form";
import type { EnderecoPedidoForm } from "@/app/(protegido)/vendas/pedidos/endereco-pedido-form";

vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: vi.fn(), buscarCepPedidoAction: vi.fn() }));
const postal = { pais: "Brasil", cep: "01001000", logradouro: "Avenida Sintética", numero: "1000", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const lista = (): EnderecoPedidoForm[] => [
  { ...postal, tipo: "PJ", documento: "11444777000161", razaoSocial: "Empresa principal sintética" },
  { ...postal, numero: "2000", tipo: "PF", documento: "11111111266", nomeCompleto: "Pessoa de outro endereço" },
  { ...postal, cep: "01001-000", logradouro: "AV. SINTETICA", tipo: "PJ", documento: "11222333000181", razaoSocial: "Empresa histórica escolhida" },
  { ...postal, complemento: "Sala 3", tipo: "PF", nomeCompleto: "Pessoa de outra sala", documento: "" },
];
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);
describe("seletor de cobranças fotografadas sem opções postais repetidas", () => {
  it("abrir e fechar mantém titular, documento, lista e índice históricos sem chamar alteração", async () => {
    const enderecos = lista(), antes = structuredClone(enderecos), alterar = vi.fn();
    render(<CobrancaClientePedido enderecos={enderecos} selecionado={2} alterar={alterar} somenteLeitura />);
    expect(screen.getByRole("group", { name: "Cobrança 3" })).toBeTruthy();
    expect(screen.getByLabelText("CNPJ")).toHaveProperty("value", "11.222.333/0001-81");
    expect(screen.getByLabelText("Razão social")).toHaveProperty("value", "Empresa histórica escolhida");
    await userEvent.click(screen.getByRole("combobox", { name: "Endereço de cobrança" }));
    expect(await screen.findAllByRole("option")).toHaveLength(3);
    expect(screen.queryByRole("option", { name: /^Principal/ })).toBeNull();
    expect(screen.getByRole("option", { name: /^Cobrança 3 · Empresa histórica escolhida/ })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(alterar).not.toHaveBeenCalled(); expect(enderecos).toEqual(antes);
    expect(screen.getByLabelText("CNPJ")).toHaveProperty("value", "11.222.333/0001-81");
  });
  it("escolha explícita e edição usam índice original sem deduplicar a lista enviada", async () => {
    const enderecos = lista(), alterar = vi.fn();
    const { rerender } = render(<CobrancaClientePedido enderecos={enderecos} selecionado={2} alterar={alterar} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Endereço de cobrança" }));
    await userEvent.click(await screen.findByRole("option", { name: /^Cobrança 2 · Pessoa de outro endereço/ }));
    expect(alterar).toHaveBeenLastCalledWith(enderecos, 1);
    expect(alterar.mock.lastCall?.[0]).toBe(enderecos);
    rerender(<CobrancaClientePedido enderecos={enderecos} selecionado={1} alterar={alterar} />);
    expect(screen.getByLabelText("CPF")).toHaveProperty("value", "111.111.112-66");
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "2001" } });
    const [novaLista, indice] = alterar.mock.lastCall!;
    expect(indice).toBe(1); expect(novaLista).toHaveLength(4);
    expect(novaLista[0]).toBe(enderecos[0]); expect(novaLista[2]).toBe(enderecos[2]); expect(novaLista[3]).toBe(enderecos[3]);
    expect(novaLista[1]).toMatchObject({ numero: "2001", documento: "11111111266" });
  });
});
