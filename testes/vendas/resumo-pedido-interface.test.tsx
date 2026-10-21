// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResumoPedido } from "@/app/(protegido)/vendas/pedidos/resumo-pedido";
import { dadosResumoSintetico } from "./resumo-pedido.fixture";

const consultar = vi.hoisted(() => vi.fn());
vi.mock("@/app/(protegido)/vendas/pedidos/resumo-pedido-actions", () => ({ consultarResumoPedidoAction: consultar }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("carrega a fonte autorizada, apresenta preview seguro e abre impressão separada", async () => {
  consultar.mockResolvedValue({ dados: dadosResumoSintetico });
  const escrever = vi.fn(), fecharDocumento = vi.fn();
  const janela = { document: { write: escrever, close: fecharDocumento }, opener: window };
  const abrir = vi.spyOn(window, "open").mockReturnValue(janela as unknown as Window);
  render(<ResumoPedido pedido={{ id: "pedido-sintetico", numero: 1284 }} fechar={vi.fn()} />);
  const frame = await screen.findByTitle("Resumo comercial do pedido #1284");
  expect(consultar).toHaveBeenCalledWith("pedido-sintetico");
  expect(frame.getAttribute("sandbox")).toBe("");
  expect(frame.getAttribute("srcdoc")).toContain("Resumo do Pedido");
  fireEvent.click(screen.getByRole("button", { name: "Imprimir / salvar PDF" }));
  expect(abrir).toHaveBeenCalledWith("", "_blank");
  expect(escrever.mock.calls[0][0]).toContain('onclick="window.print()"');
  expect(fecharDocumento).toHaveBeenCalled();
  expect(janela.opener).toBeNull();
});

it("mostra falha de cálculo sem imprimir valores falsos e permite fechar", async () => {
  consultar.mockResolvedValue({ erro: "Complete os dados do orçamento para gerar o resumo." });
  const fechar = vi.fn();
  render(<ResumoPedido pedido={{ id: "pedido-sintetico", numero: 1284 }} fechar={fechar} />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Complete os dados do orçamento para gerar o resumo.");
  expect(screen.getByRole("button", { name: "Imprimir / salvar PDF" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByTitle("Resumo comercial do pedido #1284")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  await waitFor(() => expect(fechar).toHaveBeenCalled());
});

it("informa bloqueio de popup sem perder a prévia carregada", async () => {
  consultar.mockResolvedValue({ dados: dadosResumoSintetico });
  vi.spyOn(window, "open").mockReturnValue(null);
  render(<ResumoPedido pedido={{ id: "pedido-sintetico", numero: 1284 }} fechar={vi.fn()} />);
  await screen.findByTitle("Resumo comercial do pedido #1284");
  fireEvent.click(screen.getByRole("button", { name: "Imprimir / salvar PDF" }));
  expect(screen.getByRole("alert").textContent).toContain("Permita abrir a janela de impressão");
  expect(screen.getByTitle("Resumo comercial do pedido #1284")).toBeTruthy();
});
