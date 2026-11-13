// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ corrigir: vi.fn(), consulta: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/inventario/entradas/actions", () => ({ corrigirEntradaAvulsaAction: mocks.corrigir }));
vi.mock("@/app/(protegido)/insumos/movimentacoes-actions", () => ({ consultarMovimentacoesItemAction: mocks.consulta }));
import { EntradaAvulsaDetalhe } from "@/app/(protegido)/inventario/entradas/entrada-avulsa-detalhe";
import { MovimentacoesItem } from "@/app/(protegido)/insumos/movimentacoes-item";
import { detalhe, insumos, locais } from "../visual/estoque-entradas-dados";
import type { EntradaDetalheDTO } from "@/lib/inventario/entrada-avulsa-historico";
beforeEach(() => { mocks.corrigir.mockResolvedValue({ erro: "Saldo disponível insuficiente." }); });
afterEach(cleanup);
it("mostra campos anteriores/novos e conserva itens ao editar, adicionar e receber impedimento", async () => {
  const user = userEvent.setup();
  render(<EntradaAvulsaDetalhe detalhe={detalhe} insumos={insumos} locais={locais} podeEditar />);
  expect(screen.getByText("Item 1 · Quantidade")).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Editar entrada" }));
  const quantidade = screen.getAllByLabelText(/Quantidade do item/)[0];
  await user.clear(quantidade); await user.type(quantidade, "1,5");
  await user.click(screen.getByRole("button", { name: "Adicionar item" }));
  expect(screen.getAllByLabelText(/Quantidade do item/)[1]).toBe(quantidade); expect(quantidade).toHaveProperty("value", "1,5");
  await user.click(screen.getByRole("button", { name: "Remover item 1" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(await screen.findByRole("alertdialog")).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(quantidade).toHaveProperty("value", "1,5");
  await user.click(screen.getByRole("button", { name: "Salvar correção" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Saldo disponível insuficiente.");
  expect(quantidade).toHaveProperty("value", "1,5");
  expect(mocks.corrigir).toHaveBeenCalledWith(expect.objectContaining({ id: detalhe.id, versao: 2, itens: expect.arrayContaining([expect.objectContaining({ quantidade: 1.5 })]) }));
}, 15000);
it("consulta o mesmo ledger e permite ordenar o extrato sem salvar dados", async () => {
  mocks.consulta.mockResolvedValue({ dados: { total: 1, pagina: 1, paginas: 1, linhas: [{ id: "m", data: "2026-10-10T15:00:00Z", tipo: "AJUSTE_ENTRADA", quantidade: "1", entrada: true, saldoAnterior: "0", saldoPosterior: "1", origem: "Entrada avulsa", identificador: "EA-000123", href: "/inventario/entradas/entrada-ficticia", local: "Câmara", responsavel: "Teste", observacao: null }] } });
  const user = userEvent.setup(); render(<MovimentacoesItem insumoId="brie" unidade="kg" />);
  expect((await screen.findByRole("link", { name: "EA-000123" })).getAttribute("href")).toBe("/inventario/entradas/entrada-ficticia");
  await user.click(screen.getByRole("button", { name: "Data e horário" }));
  expect(mocks.consulta).toHaveBeenLastCalledWith(expect.objectContaining({ insumoId: "brie", ordem: "asc", pagina: 1 }));
  expect(await screen.findByText("+1 kg")).toBeDefined();
});
it("preserva a identificação do produto histórico fora do catálogo atual", async () => {
  const user = userEvent.setup();
  render(<EntradaAvulsaDetalhe detalhe={detalhe} insumos={[]} locais={locais} podeEditar />);
  await user.click(screen.getByRole("button", { name: "Editar entrada" }));
  expect(screen.getAllByRole("combobox", { name: "Insumo" })[0]).toHaveProperty("value", detalhe.snapshot.itens[0].nome);
  expect(screen.getAllByLabelText(/Quantidade do item/)[0]).toHaveProperty("value", "2");
});

function entradaComPagamento(bloqueio?: string): EntradaDetalheDTO {
  return { ...detalhe, id: "compra:compra-legada", versao: 0, financeiro: { pagamento: { formaPagamento: "BOLETO", parcelas: [{ valor: 160, dataVencimento: "2026-10-20" }] }, revisao: "revisao-financeira-original", bloqueio } };
}

async function abrirEdicaoFinanceira(entrada: EntradaDetalheDTO, podeEditarPagamento = true) {
  render(<EntradaAvulsaDetalhe detalhe={entrada} insumos={insumos} locais={locais} podeEditar podeEditarPagamento={podeEditarPagamento} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar entrada" }));
  return await screen.findByRole("dialog", { name: /Editar entrada avulsa/ });
}

it("edita forma e parcelas da compra legada com revisão e preserva o rascunho em erro", async () => {
  const dialogo = await abrirEdicaoFinanceira(entradaComPagamento());
  const seletor = within(dialogo).getByRole("combobox", { name: "Forma de pagamento da compra" });
  seletor.focus();
  fireEvent.keyDown(seletor, { key: "ArrowDown" });
  const pix = await screen.findByRole("option", { name: "Pix" });
  fireEvent.pointerDown(pix, { pointerType: "mouse" });
  fireEvent.click(pix);
  fireEvent.change(within(dialogo).getByLabelText("Quantidade de parcelas"), { target: { value: "2" } });
  fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(mocks.corrigir).toHaveBeenCalledOnce());
  expect(mocks.corrigir).toHaveBeenCalledWith(expect.objectContaining({ id: "compra:compra-legada", versao: 0, pagamento: expect.objectContaining({ formaPagamento: "PIX", revisao: "revisao-financeira-original", parcelas: [{ valor: 80, dataVencimento: "2026-10-20" }, { valor: 80, dataVencimento: "2026-11-20" }] }) }));
  expect(await within(dialogo).findByRole("alert")).toHaveProperty("textContent", "Saldo disponível insuficiente.");
  expect(within(dialogo).getByLabelText("Quantidade de parcelas")).toHaveProperty("value", "2");
  expect(within(dialogo).getByLabelText("Valor da parcela 1")).toHaveProperty("value", "80,00");
  const chave = mocks.corrigir.mock.calls[0][0].chave;
  fireEvent.click(await within(dialogo).findByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(mocks.corrigir).toHaveBeenCalledTimes(2));
  expect(mocks.corrigir.mock.calls[1][0].chave).toBe(chave);
});

it.each([
  { bloqueio: "Compra com pagamento ou vínculo financeiro. Corrija o vínculo antes de alterar as parcelas.", permitido: true },
  { bloqueio: undefined, permitido: false },
])("preserva correção física quando o pagamento está bloqueado ($permitido)", async ({ bloqueio, permitido }) => {
  const dialogo = await abrirEdicaoFinanceira(entradaComPagamento(bloqueio), permitido);
  expect(within(dialogo).getByRole("combobox", { name: "Forma de pagamento da compra" })).toHaveProperty("disabled", true);
  expect(within(dialogo).getByLabelText("Quantidade de parcelas").closest("fieldset")).toHaveProperty("disabled", true);
  expect(within(dialogo).getByLabelText("Quantidade do item 1").closest("fieldset")).toHaveProperty("disabled", false);
  fireEvent.change(within(dialogo).getByLabelText("Observação / motivo"), { target: { value: "Conferência física revisada." } });
  fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(mocks.corrigir).toHaveBeenCalledOnce());
  expect(mocks.corrigir.mock.calls[0][0]).not.toHaveProperty("pagamento");
  expect(mocks.corrigir.mock.calls[0][0].observacao).toBe("Conferência física revisada.");
});

it("conserva o fluxo de entrada simples sem obrigação financeira", async () => {
  const simples: EntradaDetalheDTO = { ...detalhe, snapshot: { ...detalhe.snapshot, tipo: "OUTRO_MOTIVO" }, financeiro: undefined };
  const dialogo = await abrirEdicaoFinanceira(simples);
  expect(within(dialogo).queryByRole("combobox", { name: "Forma de pagamento da compra" })).toBeNull();
  fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(mocks.corrigir).toHaveBeenCalledOnce());
  expect(mocks.corrigir.mock.calls[0][0]).not.toHaveProperty("pagamento");
});
