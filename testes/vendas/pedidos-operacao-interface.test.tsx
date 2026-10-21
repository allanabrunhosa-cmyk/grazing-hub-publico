// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("@/app/(protegido)/vendas/pedidos/producao/actions", () => ({ produzirMaterialAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ executarOperacaoPedidoAction: vi.fn(async () => ({ erro: "Quantidade excede o restante do item." })) }));
import { OperacaoPedido, type ResumoOperacional } from "@/app/(protegido)/vendas/pedidos/[id]/operacao/operacao-client";
import { htmlResumoPedido } from "@/app/(protegido)/vendas/pedidos/[id]/operacao/impressao";
import { executarOperacaoPedidoAction } from "@/app/(protegido)/vendas/pedidos/actions";
afterEach(cleanup);
it("oferece retirada sem saída de transporte quando o pedido está pronto", async () => {
  render(<OperacaoPedido editar pedido={{ ...pedido, atendimento: "RETIRADA", statusOperacional: "PRONTO" }} />);
  expect(screen.queryByRole("button", { name: "Registrar saída para entrega" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Registrar retirada" }));
  await waitFor(() => expect(executarOperacaoPedidoAction).toHaveBeenCalledWith("p", 3, { tipo: "ENTREGAR" }, expect.any(String)));
});
const pedido: ResumoOperacional = { id: "p", numero: 1, versao: 3, status: "CONFIRMADO", statusOperacional: "EM_PREPARO", previsaoData: "2026-10-01", previsaoJanela: "manhã", observacoes: "Sem alteração silenciosa", destinatarioSnapshot: { nome: "Pessoa fictícia" }, enderecoSnapshot: { logradouro: "Rua fictícia" }, itens: [{ id: "i", quantidade: "2", unidadeSnapshot: "UN", produtoSnapshot: { nome: "Caixa fictícia" }, escolhasSnapshot: [{ opcaoNome: "Extra", quantidade: 1 }] }], historico: [] };
it("preserva quantidade digitada quando o servidor recusa e mantém controles inacessíveis sem permissão", async () => {
  const { unmount } = render(<OperacaoPedido pedido={pedido} editar />);
  fireEvent.change(screen.getByLabelText("Quantidade de Caixa fictícia"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar quantidade preparada" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("excede"));
  expect((screen.getByLabelText("Quantidade de Caixa fictícia") as HTMLInputElement).value).toBe("3");
  expect(executarOperacaoPedidoAction).toHaveBeenCalledWith("p", 3, { tipo: "PREPARAR", itemId: "i", quantidade: "3" }, expect.any(String));
  unmount(); render(<OperacaoPedido pedido={pedido} editar={false} />);
  expect(screen.queryByRole("button", { name: "Concluir preparação" })).toBeNull();
});
it("impressão preserva itens e observações escapando conteúdo", () => {
  const html = htmlResumoPedido({ ...pedido, observacoes: '<script>alert("x")</script>' });
  expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
  expect(html).toContain("Caixa fictícia"); expect(html).toContain("1 × Extra"); expect(html).toContain("2 UN");
});

vi.mock("@/app/(protegido)/vendas/pedidos/fisico-actions", () => ({ executarFisicoPedidoAction: vi.fn(async () => ({ erro: "Estoque disponível insuficiente." })) }));
import { FisicoPedido } from "@/app/(protegido)/vendas/pedidos/[id]/operacao/fisico-client";
it("materiais preservam preenchimento na recusa e separam quantidade comercial do material", async () => {
  render(<FisicoPedido id="p" versao={2} editar locais={[{ id: "l", nome: "Local fictício" }]} itens={[{ id: "i", nome: "Caixa fictícia" }]} reservas={[{ id: "r", itemId: "i", nome: "Material", local: "Local fictício", unidade: "KG", reservada: "2", consumida: "0", liberada: "0", retornada: "0", perdida: "0", lote: "lote-ficticio" }]} />);
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("combobox", { name: "Item" }));
  await usuario.click(await screen.findByRole("option", { name: "Caixa fictícia" }));
  await usuario.click(screen.getByRole("combobox", { name: "Local" }));
  await usuario.click(await screen.findByRole("option", { name: "Local fictício" }));
  fireEvent.change(screen.getByLabelText("Quantidade do item"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Quantidade do material"), { target: { value: "0.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Reservar para preparação" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("insuficiente"));
  expect((screen.getByLabelText("Quantidade do item") as HTMLInputElement).value).toBe("2");
  expect((screen.getByLabelText("Quantidade do material") as HTMLInputElement).value).toBe("0.5");
});
it("histórico usa o fuso fotografado do pedido mesmo quando o servidor está em UTC", () => {
  render(<OperacaoPedido editar={false} pedido={{ ...pedido, fusoHorario: "America/Sao_Paulo", historico: [{ id: "h", tipo: "OPERACAO_INICIAR", motivo: null, usuarioNome: "Operador fictício", createdAt: "2026-09-27T00:30:00Z", depois: { comando: { tipo: "INICIAR" } } }] }} />);
  expect(screen.getByText(/Início da preparação · Operador fictício/).textContent).toContain("26/09/2026, 21:30:00");
});
