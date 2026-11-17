// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { receber } = vi.hoisted(() => ({ receber: vi.fn() }));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ registrarRecebimentoPedidoAction: receber, corrigirRecebimentoPedidoAction: vi.fn(), criarRascunhoPedidoAction: vi.fn(), salvarRascunhoPedidoAction: vi.fn(), confirmarPedidoVendaAction: vi.fn(), revisarPedidoVendaAction: vi.fn(), solicitarDevolucaoPedidoAction: vi.fn(), cancelarPedidoVendaAction: vi.fn(), executarOperacaoPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/entregas-actions", () => ({ calcularFretePedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/custos-entrega-actions", () => ({ salvarCustoEntregaAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({ buscarCnpjPedidoAction: vi.fn(), criarClienteDoPedidoAction: vi.fn(), buscarCepPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/produtos/embalagens-actions", () => ({ salvarTipoEmbalagemAction: vi.fn() }));
import { EditorPedido } from "@/app/(protegido)/vendas/pedidos/editor-pedido";

const dados = { horarios: null, catalogo: { produtos: [], grupos: [], categorias: [] }, clientes: [], canais: [], formas: [], categorias: [], contas: [{ id: "conta-ficticia", nome: "Conta fictícia" }], categoriasTaxa: [{ id: "taxa-ficticia", nome: "Tarifas fictícias" }], categoriasDevolucao: [], creditos: {} } as unknown as React.ComponentProps<typeof EditorPedido>["dados"];
const titulo = (forma: Record<string, unknown>) => ({ id: "titulo-ficticio", revisao: "2026-10-01T12:00:00.000Z", raiz: "parcela-1", valorOriginal: "350.00", valor: "350.00", status: "PENDENTE", quitadoCredito: false, vencimento: "2026-10-05T00:00:00.000Z", forma, dataPagamento: null });
const pedido = (forma: Record<string, unknown>) => ({ id: "pedido-ficticio", numero: 101, versao: 3, status: "CONFIRMADO", modoFinanceiro: "HUB", versaoFinanceiro: 1, clienteId: null, canalId: null, canalNomeSnapshot: "Site", compradorSnapshot: { nome: "Comprador fictício" }, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatarioSnapshot: null, enderecoSnapshot: null, observacoes: "", subtotal: "350", desconto: "0", frete: "0", total: "350", confirmadoEm: "2026-10-01T12:00:00Z", entregueEm: null, rascunho: null, itens: [], historico: [], historicoFinanceiro: [], financeiro: { recebido: "0", saldo: "350", titulos: [titulo(forma)], externos: [], tratamentos: [] } });
const capacidades = { rascunho: false, confirmar: false, revisar: false, desconto: false, preco: false, cancelar: false, receber: true, condicao: false };
const escolher = async (usuario: ReturnType<typeof userEvent.setup>, rotulo: string, opcao: string) => { await usuario.click(screen.getByLabelText(rotulo)); await usuario.click(await screen.findByRole("option", { name: opcao })); };
const abrir = async (forma: Record<string, unknown>) => {
  const usuario = userEvent.setup();
  render(<EditorPedido pedido={pedido(forma) as never} dados={dados} capacidades={capacidades} emDialogo />);
  await usuario.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  await escolher(usuario, "Conta que recebeu", "Conta fictícia");
  await usuario.type(screen.getByLabelText("Data do recebimento"), "2026-10-02");
  return usuario;
};
beforeEach(() => { vi.clearAllMocks(); HTMLElement.prototype.scrollIntoView = vi.fn(); receber.mockResolvedValue({ ok: true, financeiro: { recebido: "350", saldo: "0", titulos: [], externos: [], tratamentos: [] } }); });
afterEach(cleanup);

it("Pix com taxa mostra o valor da taxa e exige a categoria antes de confirmar o recebimento", async () => {
  const usuario = await abrir({ nome: "Pix", tipo: "PIX", taxaPercentual: "0", taxaFixa: "0.75" });
  expect(screen.getByText(/Taxa do Pix deste recebimento: R\$\s0,75/)).toBeTruthy();
  const confirmar = screen.getByRole("button", { name: "Confirmar recebimento" });
  expect(confirmar).toHaveProperty("disabled", true);
  await escolher(usuario, "Categoria da taxa do Pix", "Tarifas fictícias");
  expect(confirmar).toHaveProperty("disabled", false);
  await usuario.click(confirmar);
  await waitFor(() => expect(receber).toHaveBeenCalledTimes(1));
  expect(receber).toHaveBeenCalledWith("pedido-ficticio", "titulo-ficticio", "350.00", "conta-ficticia", "2026-10-02", expect.any(String), "taxa-ficticia");
  expect(await screen.findByText(/taxa do Pix de R\$\s0,75 foi lançada como despesa financeira/)).toBeTruthy();
});

it("Pix sem taxa mantém o recebimento atual, sem categoria", async () => {
  const usuario = await abrir({ nome: "Pix", tipo: "PIX", taxaPercentual: "0", taxaFixa: "0" });
  expect(screen.queryByLabelText("Categoria da taxa do Pix")).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(receber).toHaveBeenCalledTimes(1));
  expect(receber).toHaveBeenCalledWith("pedido-ficticio", "titulo-ficticio", "350.00", "conta-ficticia", "2026-10-02", expect.any(String), undefined);
});
