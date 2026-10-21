// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PedidoDialog } from "@/app/(protegido)/compras/pedido-dialog";
import { PedidosView } from "@/app/(protegido)/compras/pedidos-view";
import { RecebimentoDialog } from "@/app/(protegido)/compras/recebimento-dialog";
import { PedidosCalendario } from "@/app/(protegido)/compras/pedidos-calendario";
vi.mock("server-only", () => ({}));
import type { PedidoRow } from "@/app/(protegido)/compras/types";
const { salvar, receber } = vi.hoisted(() => ({ salvar: vi.fn(async () => ({ ok: true, pedidoId: "p" })), receber: vi.fn(async () => ({ ok: true, recebimentoId: "r" })) }));
vi.mock("@/app/(protegido)/compras/actions", () => ({ salvarPedidoAction: salvar, confirmarRecebimentoAction: receber }));
beforeEach(() => {
  sessionStorage.clear();
  salvar.mockReset();
  salvar.mockResolvedValue({ ok: true, pedidoId: "p" });
  receber.mockClear();
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
const pedido: PedidoRow = { id: "p", numero: 1, fornecedorId: null, fornecedorAvulso: "Papelaria", fornecedorNome: "Papelaria", usoConsumo: true, dataPedido: new Date().toISOString(), previsaoEntrega: null, status: "CONFIRMADO", observacoes: null, temDivergencia: false, recebimentos: [], itens: [{ id: "i", insumoId: null, insumoNome: "Papel", quantidade: 3, unidadeCompra: "UN", precoUnitario: 10, precoTotal: 30 }] };
it("envia a descrição e o fornecedor avulso sem depender de insumo", async () => {
  const usuario = userEvent.setup();
  render(<PedidoDialog open onOpenChange={vi.fn()} fornecedores={[]} insumos={[]} cotacoes={[]} />);
  await usuario.click(screen.getByRole("button", { name: "Uso e consumo" }));
  await usuario.click(screen.getByRole("checkbox", { name: "Fornecedor não cadastrado" }));
  await usuario.type(screen.getByLabelText("Nome do fornecedor avulso"), "Papelaria");
  await usuario.type(screen.getByLabelText("Descrição do item"), "Papel");
  await usuario.type(screen.getByLabelText("Quantidade"), "3");
  await usuario.type(screen.getByLabelText("Preço unitário"), "1299");
  expect((screen.getByLabelText("Preço unitário") as HTMLInputElement).value).toBe("12,99");
  await usuario.click(screen.getByRole("button", { name: "Criar pedido" }));
  await waitFor(() => expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ fornecedorId: null, fornecedorAvulso: "Papelaria", usoConsumo: true, itens: [expect.objectContaining({ insumoId: null, descricao: "Papel", quantidade: 3, precoUnitario: 12.99 })] })));
});
it("inclui itens sem insumo ao confirmar recebimento", async () => {
  const usuario = userEvent.setup();
  render(<RecebimentoDialog open onOpenChange={vi.fn()} pedido={pedido} insumos={[]} />);
  expect(screen.queryByText("Adicionar insumo (fora do pedido)")).toBeNull();
  await usuario.type(screen.getByPlaceholderText("Nome de quem recebeu"), "Ana");
  await usuario.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(receber).toHaveBeenCalledWith(expect.objectContaining({ itens: [expect.objectContaining({ pedidoItemId: "i", insumoId: null, quantidadeRecebida: 3 })] })));
});
it("alterna a visão semanal e mantém pedidos sem data acessíveis", async () => {
  const usuario = userEvent.setup(), selecionar = vi.fn();
  render(<PedidosCalendario pedidos={[pedido]} onSelecionar={selecionar} />);
  expect(screen.getByText("Sem previsão de entrega (1)")).toBeDefined();
  await usuario.click(screen.getByRole("button", { name: "Semanal" }));
  expect(screen.getByRole("button", { name: "Próxima semana" })).toBeDefined();
  await usuario.click(screen.getByRole("button", { name: "#0001 — Papelaria — Pendente" }));
  expect(selecionar).toHaveBeenCalledWith(pedido);
});

it("libera catálogo de insumos para fornecedor avulso nos dois tipos de compra", async () => {
  const usuario = userEvent.setup();
  render(<PedidoDialog open onOpenChange={vi.fn()} fornecedores={[]} insumos={[{ id: "insumo-avulso", nome: "Detergente", unidade: "UN", custoMedio: 5, fornecedorPrincipalId: null, fornecedorIds: [] }]} cotacoes={[]} />);
  await usuario.click(screen.getByRole("checkbox", { name: "Fornecedor não cadastrado" }));
  await usuario.type(screen.getByLabelText("Nome do fornecedor avulso"), "Loja pontual");
  await usuario.click(screen.getByPlaceholderText("Buscar insumo..."));
  await usuario.click(await screen.findByRole("option", { name: "Detergente" }));
  await usuario.type(screen.getByLabelText("Quantidade"), "2");
  await usuario.click(screen.getByRole("button", { name: "Uso e consumo" }));
  expect((screen.getByLabelText("Nome do fornecedor avulso") as HTMLInputElement).value).toBe("Loja pontual");
  await usuario.click(screen.getByRole("button", { name: "Itens de estoque" }));
  await usuario.click(screen.getByRole("button", { name: "Criar pedido" }));
  await waitFor(() => expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ usoConsumo: false, fornecedorId: null, fornecedorAvulso: "Loja pontual", itens: [expect.objectContaining({ insumoId: "insumo-avulso", quantidade: 2 })] })));
});

it("preserva o pedido e orienta a recarga quando a versão da ação mudou", async () => {
  salvar.mockRejectedValueOnce(new Error("Failed to find Server Action"));
  const usuario = userEvent.setup();
  render(<PedidoDialog open onOpenChange={vi.fn()} fornecedores={[]} insumos={[]} cotacoes={[]} />);

  await usuario.click(screen.getByRole("button", { name: "Uso e consumo" }));
  await usuario.click(screen.getByRole("checkbox", { name: "Fornecedor não cadastrado" }));
  await usuario.type(screen.getByLabelText("Nome do fornecedor avulso"), "Mega G");
  await usuario.type(screen.getByLabelText("Descrição do item"), "Embalagem");
  await usuario.type(screen.getByLabelText("Quantidade"), "4");
  await usuario.click(screen.getByRole("button", { name: "Criar pedido" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Seus dados foram preservados");
  expect(screen.getByRole("button", { name: "Atualizar página" })).toBeDefined();
  expect((screen.getByLabelText("Nome do fornecedor avulso") as HTMLInputElement).value).toBe("Mega G");
  expect((screen.getByLabelText("Quantidade") as HTMLInputElement).value).toBe("4");
  expect(sessionStorage.getItem("grazing-hub:compras:novo-pedido:v1")).toContain("Mega G");
});

it("recupera o rascunho do pedido depois da atualização da página", async () => {
  sessionStorage.setItem("grazing-hub:compras:novo-pedido:v1", JSON.stringify({
    versao: 1,
    usoConsumo: true,
    avulso: true,
    fornecedorAvulso: "Mega G",
    fornecedorId: null,
    previsaoEntrega: "2026-09-18",
    observacoes: "Entregar pela manhã",
    linhas: [{ insumoId: null, descricao: "Embalagem", quantidade: "4", unidadeCompra: "UN", precoUnitario: "2.50" }],
  }));

  render(<PedidoDialog open onOpenChange={vi.fn()} fornecedores={[]} insumos={[]} cotacoes={[]} />);

  expect((await screen.findByRole("status")).textContent).toContain("pedido que estava sendo preenchido foi recuperado");
  expect((screen.getByLabelText("Nome do fornecedor avulso") as HTMLInputElement).value).toBe("Mega G");
  expect((screen.getByLabelText("Descrição do item") as HTMLInputElement).value).toBe("Embalagem");
  expect((screen.getByLabelText("Quantidade") as HTMLInputElement).value).toBe("4");
  expect((screen.getByLabelText("Data de entrega") as HTMLInputElement).value).toBe("2026-09-18");
  expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Entregar pela manhã");
});

it("reabre automaticamente o novo pedido quando há rascunho recuperável", async () => {
  sessionStorage.setItem("grazing-hub:compras:novo-pedido:v1", JSON.stringify({
    versao: 1,
    usoConsumo: true,
    avulso: true,
    fornecedorAvulso: "Mega G",
    fornecedorId: null,
    previsaoEntrega: "",
    observacoes: "",
    linhas: [{ insumoId: null, descricao: "Embalagem", quantidade: "4", unidadeCompra: "UN", precoUnitario: "" }],
  }));

  render(<PedidosView pedidos={[]} fornecedores={[]} insumos={[]} cotacoes={[]} />);

  expect(await screen.findByRole("dialog")).toBeDefined();
  expect((screen.getByLabelText("Nome do fornecedor avulso") as HTMLInputElement).value).toBe("Mega G");
});

it("situações de compras contam busca, excluídos e recebidos com divergência", async () => {
  const { PedidosTable } = await import("@/app/(protegido)/compras/pedidos-table");
  const u = userEvent.setup();
  render(<PedidosTable pedidos={[
    pedido, { ...pedido, id: "recebido", status: "RECEBIDO_TOTAL", temDivergencia: true },
    { ...pedido, id: "excluido", excluidoEm: "2026-09-01T12:00:00Z" },
  ]} onSelecionar={vi.fn()} />);
  for (const nome of ["Todos (2)", "Pendente (1)", "Atrasado (0)", "Recebido (1)", "Excluídos (1)"]) expect(screen.getByRole("button", { name: nome })).toBeTruthy();
  await u.type(screen.getByRole("textbox"), "inexistente");
  for (const nome of ["Todos (0)", "Pendente (0)", "Atrasado (0)", "Recebido (0)", "Excluídos (0)"]) expect(screen.getByRole("button", { name: nome })).toBeTruthy();
});
