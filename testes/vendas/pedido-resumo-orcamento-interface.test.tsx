// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { criarDetalheFixture, dadosDetalhe, capacidadesDetalhe } from "../visual/pedido-detalhe-fixture";
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/actions", () => ({ criarRascunhoPedidoAction: vi.fn(), salvarRascunhoPedidoAction: vi.fn(), confirmarPedidoVendaAction: vi.fn(), revisarPedidoVendaAction: vi.fn(), cancelarPedidoVendaAction: vi.fn(), registrarEntregaPedidoVendaAction: vi.fn(), consultarCreditoClientePedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: vi.fn(), buscarCepPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/entregas-actions", () => ({ calcularFretePedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/custos-entrega-actions", () => ({ salvarCustoEntregaAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/produtos/embalagens-actions", () => ({ salvarTipoEmbalagemAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/resumo-pedido", () => ({ ResumoPedido: ({ pedido }: { pedido: { numero: number } }) => <p>Resumo comercial #{pedido.numero}</p> }));
import { EditorPedido, entradaDoPedido } from "@/app/(protegido)/vendas/pedidos/editor-pedido";
afterEach(cleanup);
function abrir() {
  const p = criarDetalheFixture();
  const pedido = { ...p, status: "RASCUNHO", rascunho: entradaDoPedido(p), financeiro: { ...p.financeiro, titulos: [], tratamentos: [] } };
  render(<EditorPedido emDialogo pedido={pedido} dados={dadosDetalhe} capacidades={{ ...capacidadesDetalhe, confirmar: false }} />);
}
it("abre resumo comercial de orçamento salvo sem exigir pagamento ou confirmação", async () => {
  abrir();
  await userEvent.click(screen.getByRole("button", { name: "Mais ações do orçamento" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Resumo do pedido" }));
  expect(await screen.findByText("Resumo comercial #101")).toBeTruthy();
});
it("exige salvar alterações antes de gerar um resumo de orçamento", async () => {
  abrir();
  fireEvent.change(screen.getByLabelText("Observações"), { target: { value: "Nova observação do orçamento" } });
  expect(screen.getByText("Salve o orçamento para atualizar o resumo.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Mais ações do orçamento" }));
  expect((await screen.findByRole("menuitem", { name: "Resumo do pedido" })).getAttribute("aria-disabled")).toBe("true");
  expect(screen.queryByText("Resumo comercial #101")).toBeNull();
});
