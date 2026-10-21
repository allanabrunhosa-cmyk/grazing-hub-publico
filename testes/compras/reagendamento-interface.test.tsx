// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PedidosView } from "@/app/(protegido)/compras/pedidos-view";
import { PedidosCalendario } from "@/app/(protegido)/compras/pedidos-calendario";
import { dataISO } from "@/app/(protegido)/compras/calendario";
import type { PedidoRow } from "@/app/(protegido)/compras/types";
vi.mock("server-only", () => ({}));
const { reagendar, salvar } = vi.hoisted(() => ({ reagendar: vi.fn(), salvar: vi.fn(async () => ({ ok: true, pedidoId: "novo" })) }));
vi.mock("@/app/(protegido)/compras/actions", () => ({ salvarPedidoAction: salvar, excluirPedidoAction: vi.fn(), confirmarRecebimentoAction: vi.fn(), reabrirPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/compras/reagendar-pedido", () => ({ reagendarPedidoAction: reagendar }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const hoje = new Date();
const outroDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() === 1 ? 2 : hoje.getDate() - 1);
const iso = dataISO(hoje), outroISO = dataISO(outroDia);
const pedido: PedidoRow = { id: "mover", numero: 77, fornecedorId: null, fornecedorNome: "Loja do teste", fornecedorAvulso: "Loja do teste", usoConsumo: true, dataPedido: hoje.toISOString(), previsaoEntrega: iso + "T12:00:00.000Z", status: "CONFIRMADO", temDivergencia: false, observacoes: null, recebimentos: [], itens: [] };
function dia(data: Date) { return screen.getByRole("region", { name: data.toLocaleDateString("pt-BR") }); }
function arrastar(origem: HTMLElement, destino: HTMLElement) {
  const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(origem, { dataTransfer });
  fireEvent.dragOver(destino, { dataTransfer });
  fireEvent.drop(destino, { dataTransfer });
  fireEvent.dragEnd(origem, { dataTransfer });
}
it("abre novo pedido pelo espaço livre com a data selecionada, sem reaproveitar a data anterior", async () => {
  const usuario = userEvent.setup();
  render(<PedidosView pedidos={[pedido]} fornecedores={[]} insumos={[]} cotacoes={[]} />);
  expect(screen.getByRole("button", { name: "Lista" }).getAttribute("aria-pressed")).toBe("true");
  await usuario.click(screen.getByRole("button", { name: "Calendário" }));
  expect(screen.getByRole("button", { name: "Calendário" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Lista" }).getAttribute("aria-pressed")).toBe("false");
  await usuario.click(dia(outroDia));
  expect((screen.getByLabelText("Data de entrega") as HTMLInputElement).value).toBe(outroISO);
  await usuario.keyboard("{Escape}");
  await usuario.click(screen.getByRole("button", { name: `Novo pedido em ${hoje.toLocaleDateString("pt-BR")}` }));
  expect((screen.getByLabelText("Data de entrega") as HTMLInputElement).value).toBe(iso);
  await usuario.keyboard("{Escape}");
  await usuario.click(screen.getByRole("button", { name: "Novo pedido" }));
  expect((screen.getByLabelText("Data de entrega") as HTMLInputElement).value).toBe("");
});
it("clicar no cartão abre somente os detalhes, sem criar pedido", async () => {
  const usuario = userEvent.setup(), selecionar = vi.fn(), criar = vi.fn();
  render(<PedidosCalendario pedidos={[pedido]} onSelecionar={selecionar} onNovoPedido={criar} onReagendar={vi.fn()} />);
  await usuario.click(screen.getByRole("button", { name: /#0077 —/ }));
  expect(selecionar).toHaveBeenCalledWith(pedido);
  expect(criar).not.toHaveBeenCalled();
});
it("move entre dias após salvar, usa a nova data nos detalhes e não abre diálogo após soltar", async () => {
  reagendar.mockResolvedValue({ ok: true, previsaoEntrega: outroISO + "T12:00:00.000Z" });
  const usuario = userEvent.setup();
  const { rerender } = render(<PedidosView pedidos={[pedido]} fornecedores={[]} insumos={[]} cotacoes={[]} />);
  await usuario.click(screen.getByRole("button", { name: "Calendário" }));
  const cartao = screen.getByRole("button", { name: /#0077 —/ });
  arrastar(cartao, dia(outroDia));
  fireEvent.click(dia(outroDia));
  await waitFor(() => expect(within(dia(outroDia)).getByRole("button", { name: /#0077 —/ })).toBeDefined());
  expect(reagendar).toHaveBeenCalledWith({ pedidoId: pedido.id, previsaoAnterior: iso, previsaoEntrega: outroISO });
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect((screen.getByRole("button", { name: /#0077 —/ }) as HTMLButtonElement).disabled).toBe(false));
  await usuario.click(screen.getByRole("button", { name: /#0077 —/ }));
  expect(within(screen.getByRole("dialog")).getByText(outroDia.toLocaleDateString("pt-BR"))).toBeDefined();
  await usuario.keyboard("{Escape}");
  // Uma atualização posterior do servidor deve prevalecer sobre o resultado local.
  rerender(<PedidosView pedidos={[{ ...pedido }]} fornecedores={[]} insumos={[]} cotacoes={[]} />);
  expect(within(dia(hoje)).getByRole("button", { name: /#0077 —/ })).toBeDefined();
});
it.each(["servidor", "rede"])("preserva a data quando há falha de %s", async tipo => {
  if (tipo === "rede") reagendar.mockRejectedValue(new Error("offline"));
  else reagendar.mockResolvedValue({ erro: "A data deste pedido foi alterada." });
  const usuario = userEvent.setup();
  render(<PedidosView pedidos={[pedido]} fornecedores={[]} insumos={[]} cotacoes={[]} />);
  await usuario.click(screen.getByRole("button", { name: "Calendário" }));
  arrastar(screen.getByRole("button", { name: /#0077 —/ }), dia(outroDia));
  await screen.findByRole("alert");
  expect(within(dia(hoje)).getByRole("button", { name: /#0077 —/ })).toBeDefined();
  expect(within(dia(outroDia)).queryByRole("button", { name: /#0077 —/ })).toBeNull();
});
it("ignora o mesmo dia e arrastos externos e bloqueia recebidos, cancelados e excluídos", () => {
  const mover = vi.fn();
  render(<PedidosCalendario pedidos={[pedido, { ...pedido, id: "recebido", numero: 78, status: "RECEBIDO_TOTAL" }, { ...pedido, id: "cancelado", numero: 79, status: "CANCELADO" }, { ...pedido, id: "excluido", numero: 80, excluidoEm: hoje.toISOString() }]} onSelecionar={vi.fn()} onReagendar={mover} />);
  fireEvent.drop(dia(outroDia), { dataTransfer: { getData: () => pedido.id } });
  arrastar(screen.getByRole("button", { name: /#0077 —/ }), dia(hoje));
  expect(mover).not.toHaveBeenCalled();
  for (const numero of [78, 79]) expect(screen.getByRole("button", { name: new RegExp(`#00${numero} —`) }).getAttribute("draggable")).toBe("false");
  expect(screen.queryByRole("button", { name: /#0080 —/ })).toBeNull();
});
it("permite levar pedido sem data a um dia do calendário", () => {
  const mover = vi.fn();
  const semData = { ...pedido, previsaoEntrega: null };
  render(<PedidosCalendario pedidos={[semData]} onSelecionar={vi.fn()} onReagendar={mover} />);
  arrastar(screen.getByRole("button", { name: /#0077 —/ }), dia(outroDia));
  expect(mover).toHaveBeenCalledWith(semData, outroISO);
});
