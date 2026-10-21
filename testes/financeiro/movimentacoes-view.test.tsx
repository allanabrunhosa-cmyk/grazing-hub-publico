// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { lancamentoTeste } from "./dados-movimentacoes";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: simulados.navegar, refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/financeiro/movimentacoes/conciliacao-actions", () => ({ prepararExtratoAction: vi.fn(), importarExtratoAction: vi.fn(), conciliarExtratoAction: vi.fn(), desfazerConciliacaoAction: vi.fn() }));

const simulados = vi.hoisted(() => ({
  navegar: vi.fn(),
  baixar: vi.fn().mockResolvedValue({ ok: true }),
  baixarNota: vi.fn().mockResolvedValue({ ok: true }),
  estornar: vi.fn().mockResolvedValue({ ok: true }),
  atualizar: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/app/(protegido)/financeiro/movimentacoes/baixar-nota", () => ({ baixarNotaFiscalAction: simulados.baixarNota }));
vi.mock("@/app/(protegido)/financeiro/contas/actions", () => ({ baixarLancamentoAction: simulados.baixar, estornarBaixaLancamentoAction: simulados.estornar }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({ criarLancamentoAction: vi.fn(), atualizarLancamentoAction: simulados.atualizar, excluirLancamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/fornecedores/actions", () => ({ salvarBeneficiarioAction: vi.fn() }));
import { MovimentacoesView } from "@/app/(protegido)/financeiro/movimentacoes/movimentacoes-view";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const mes = "2026-09";
const pendente = lancamentoTeste({ dataVencimento: `${mes}-10T12:00:00Z` });
const props = { linhas: [pendente], avulsas: [], saldoInicial: 1000, categorias: [], fornecedores: [], formasPagamento: [], contasBancarias: [{ id: "banco", nome: "Conta principal" }] };
it("link de atividade abre detalhe de leitura mesmo fora do período, sem editor ou operação", () => {
  render(<MovimentacoesView {...props} linhas={[{ ...pendente, dataVencimento: "2020-01-10" }]} entidadeInicialId={pendente.id} />);
  const detalhe = screen.getByRole("dialog");
  expect(within(detalhe).getByText("Detalhes da movimentação")).toBeTruthy();
  expect(within(detalhe).queryByRole("button", { name: "Editar" })).toBeNull();
  expect(within(detalhe).queryByRole("button", { name: "Excluir" })).toBeNull();
  expect(within(detalhe).queryByRole("button", { name: "Realizar movimentação" })).toBeNull();
  expect(simulados.baixar).not.toHaveBeenCalled();
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it("link ausente, cancelado ou quitado por crédito não abre detalhe inexistente", () => {
  for (const linha of [pendente, lancamentoTeste({ status: "CANCELADO" }), lancamentoTeste({ pedidoQuitadoCredito: true })]) {
    const { unmount } = render(<MovimentacoesView {...props} linhas={[linha]} entidadeInicialId={linha === pendente ? "nao-existe" : pendente.id} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
  }
});
it("título de pedido encaminha à origem e não oferece baixa, edição ou exclusão genérica", () => {
  render(<MovimentacoesView {...props} linhas={[{ ...pendente, pedidoVendaId: "pedido-ficticio" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir pedido de Aluguel da cozinha" }));
  expect(simulados.navegar).toHaveBeenCalledWith("/vendas/pedidos/pedido-ficticio");
  expect(screen.queryByText("Realizar movimentação")).toBeNull();
  fireEvent.click(screen.getByText("Ocupação"));
  const detalhe = screen.getByRole("dialog");
  expect(within(detalhe).getByRole("button", { name: "Abrir pedido" })).toBeTruthy();
  expect(within(detalhe).queryByRole("button", { name: "Excluir" })).toBeNull();
  expect(within(detalhe).queryByRole("button", { name: "Editar" })).toBeNull();
  expect(simulados.baixar).not.toHaveBeenCalled();
});

it("abre detalhes pela célula de categoria e baixa pela data escolhida", async () => {
  render(<MovimentacoesView {...props} />);
  fireEvent.click(screen.getByText("Ocupação"));
  expect(screen.getByText("Detalhes da movimentação")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Realizar movimentação" }));
  expect(simulados.baixar).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Data da transação"), { target: { value: `${mes}-12` } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));
  await waitFor(() => expect(simulados.baixar).toHaveBeenCalledWith("aluguel", "banco", `${mes}-12`));
});
it("baixa rápida abre só a confirmação, sem abrir detalhes nem gravar antecipadamente", () => {
  render(<MovimentacoesView {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Realizar Aluguel da cozinha" }));
  expect(screen.queryByText("Detalhes da movimentação")).toBeNull();
  expect(screen.getByLabelText("Data da transação")).toBeTruthy();
  expect(simulados.baixar).not.toHaveBeenCalled();
});

it("volta à lista após salvar a edição aberta pelos detalhes", async () => {
  render(<MovimentacoesView {...props} />);
  fireEvent.click(screen.getByText("Ocupação"));
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));

  fireEvent.change(screen.getByDisplayValue("Aluguel da cozinha"), { target: { value: "Aluguel atualizado" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

  await waitFor(() => expect(simulados.atualizar).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Detalhes da movimentação")).toBeNull());
  expect(screen.getByRole("row", { name: "Ver detalhes: Aluguel da cozinha" })).toBeTruthy();
}, 15_000);
it("abre a linha por teclado e reflete baixa recebida do servidor no novo dia", async () => {
  const { rerender } = render(<MovimentacoesView {...props} />);
  fireEvent.keyDown(screen.getByRole("row", { name: "Ver detalhes: Aluguel da cozinha" }), { key: "Enter" });
  expect(screen.getByText("Detalhes da movimentação")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  rerender(<MovimentacoesView {...props} linhas={[{ ...pendente, status: "BAIXADO", dataPagamento: `${mes}-12T12:00:00Z`, contaBancariaNome: "Conta principal" }]} />);
  expect(screen.getByText("Realizado")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Realizar Aluguel da cozinha" })).toBeNull();
  const diaPagamento = screen.getByRole("region", { name: `Movimentações de 12/${mes.slice(5)}/${mes.slice(0, 4)}` });
  expect(within(diaPagamento).getByText("Realizado")).toBeTruthy();
});
it("avisa e confirma o cancelamento de uma baixa conciliada", async () => {
  const realizada = lancamentoTeste({
    status: "BAIXADO",
    dataPagamento: `${mes}-10T12:00:00Z`,
    contaBancariaId: "banco",
    contaBancariaNome: "Conta principal",
    transacaoExtratoId: "extrato",
  });
  render(<MovimentacoesView {...props} linhas={[realizada]} />);

  fireEvent.click(screen.getByRole("row", { name: "Ver detalhes: Aluguel da cozinha" }));
  expect(screen.getByText(/o vínculo com o extrato também será desfeito/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar baixa" }));
  expect(screen.getByText(/O vínculo atual com o extrato bancário também será desfeito/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento da baixa" }));
  await waitFor(() => expect(simulados.estornar).toHaveBeenCalledWith("aluguel"));
});

it("exibe uma linha por NF e confirma o total dos itens somente após escolher a data", async () => {
  const notaFiscal = { id: "nf", numero: "31562", serie: "1", fornecedorNome: "Fornecedor de frios" };
  render(<MovimentacoesView {...props} linhas={[
    { ...pendente, id: "queijo", descricao: `NF-e ${"1".repeat(44)} — Queijo`, notaFiscalItemDescricao: "Queijo", valor: 70, notaFiscal },
    { ...pendente, id: "presunto", descricao: "Presunto", valor: 30, notaFiscal },
  ]} />);
  expect(screen.getAllByRole("row", { name: "Ver detalhes: Fornecedor de frios" })).toHaveLength(1);
  expect(screen.queryByText("Queijo")).toBeNull();
  expect(screen.getByText("NF-e nº 31562 · Série 1")).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 2 }).every((titulo) => titulo.closest('[data-slot="card"]') === null)).toBe(true);
  fireEvent.click(screen.getByRole("row", { name: "Ver detalhes: Fornecedor de frios" }));
  expect(screen.getByText("Queijo")).toBeTruthy();
  expect(screen.queryByText(new RegExp("1".repeat(44)))).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Realizar movimentação" }));
  expect(simulados.baixarNota).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Data da transação"), { target: { value: `${mes}-12` } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));
  await waitFor(() => expect(simulados.baixarNota).toHaveBeenCalledWith(["presunto", "queijo"], "banco", `${mes}-12`, -100));
});

it("mantém todas as datas do filtro e distingue dias com e sem movimentação", () => {
  render(<MovimentacoesView {...props} />);
  fireEvent.change(screen.getByLabelText("De"), { target: { value: `${mes}-09` } });
  fireEvent.blur(screen.getByLabelText("De"));
  fireEvent.change(screen.getByLabelText("até"), { target: { value: `${mes}-11` } });
  fireEvent.blur(screen.getByLabelText("até"));
  const dias = screen.getAllByRole("region", { name: /^Movimentações de/ });
  expect(dias).toHaveLength(3);
  expect(within(dias[0]).getByText("Sem movimentação neste filtro")).toBeTruthy();
  expect(within(dias[1]).getByText("1 movimentação")).toBeTruthy();
  expect(within(dias[2]).getByText("Sem movimentação neste filtro")).toBeTruthy();
  expect(within(dias[0]).getByText(/1\.000,00/)).toBeTruthy();
  expect(within(dias[2]).getByText(/200,00/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^Realizados \(\d[\d.]*\)$/ }));
  expect(screen.getAllByRole("region", { name: /^Movimentações de/ })).toHaveLength(3);
  expect(screen.getAllByText("Sem movimentação neste filtro")).toHaveLength(3);
  expect(screen.queryByRole("row", { name: "Ver detalhes: Aluguel da cozinha" })).toBeNull();
});

it("identifica o início do saldo em um dia sem lançamentos", () => {
  render(<MovimentacoesView {...props} linhas={[]} saldosIniciais={[{ id: "banco", saldoInicial: 1000, dataSaldoInicial: `${mes}-10` }]} />);
  fireEvent.change(screen.getByLabelText("De"), { target: { value: `${mes}-10` } });
  fireEvent.blur(screen.getByLabelText("De"));
  fireEvent.change(screen.getByLabelText("até"), { target: { value: `${mes}-10` } });
  fireEvent.blur(screen.getByLabelText("até"));
  const dia = screen.getByRole("region", { name: /^Movimentações de/ });
  expect(within(dia).getByText("Sem movimentação neste filtro")).toBeTruthy();
  expect(within(dia).getByText(/Início do controle de saldo/)).toBeTruthy();
  expect(within(dia).getByText(/1\.000,00/)).toBeTruthy();
});


it("limpar datas inclui o histórico fora do mês inicial e preserva o saldo", () => {
  render(<MovimentacoesView {...props} linhas={[pendente, lancamentoTeste({ id: "anterior", descricao: "Despesa antiga", dataVencimento: "2026-08-31T12:00:00Z", valor: 70 })]} />);
  expect(screen.queryByText("Despesa antiga")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Limpar datas" }));
  expect(screen.getByText("Despesa antiga")).toBeTruthy();
  const cartaoSaldo = screen.getAllByText("Saldo final projetado")[0].parentElement!;
  expect(within(cartaoSaldo).getByText(/130,00/)).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("");
});

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-18T15:00:00Z")); });
afterEach(() => vi.useRealTimers());

it("abre do início do mês até hoje e exclui vencimentos futuros", () => {
  render(<MovimentacoesView {...props} linhas={[pendente, lancamentoTeste({ id: "futuro", descricao: "Despesa futura", dataVencimento: "2026-09-19T12:00:00Z" })]} />);
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-09-01");
  expect((screen.getByLabelText("até") as HTMLInputElement).value).toBe("2026-09-18");
  expect(screen.queryByText("Despesa futura")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Limpar datas" }));
  expect(screen.getByText("Despesa futura")).toBeTruthy();
});


it("o mês incompleto não muda o período aplicado nem abre o histórico", () => {
  render(<MovimentacoesView {...props} linhas={[pendente, lancamentoTeste({ id: "historica", descricao: "Despesa histórica fictícia", dataVencimento: "1000-01-01", valor: 70 })]} />);
  const inicio = screen.getByLabelText("De") as HTMLInputElement;
  Object.defineProperty(inicio, "validity", { configurable: true, get: () => ({ badInput: true, valid: false }) });
  const quantidadeDias = screen.getAllByRole("region", { name: /^Movimentações de/ }).length;
  fireEvent.change(inicio, { target: { value: "" } });
  expect(screen.getAllByRole("region", { name: /^Movimentações de/ })).toHaveLength(quantidadeDias);
  expect(screen.queryByText("Despesa histórica fictícia")).toBeNull();
  fireEvent.blur(inicio);
  expect(screen.getByRole("alert").textContent).toContain("Complete a data inicial");
  expect(screen.getAllByRole("region", { name: /^Movimentações de/ })).toHaveLength(quantidadeDias);
});

it("limpar datas mostra operações antigas sem montar todos os dias dos séculos intermediários", () => {
  render(<MovimentacoesView {...props} linhas={[pendente, lancamentoTeste({ id: "historica", descricao: "Despesa histórica fictícia", dataVencimento: "1000-01-01", valor: 70 })]} />);
  fireEvent.click(screen.getByRole("button", { name: "Limpar datas" }));
  expect(screen.getByText("Despesa histórica fictícia")).toBeTruthy();
  expect(screen.getAllByRole("region", { name: /^Movimentações de/ })).toHaveLength(2);
  expect(screen.getByRole("status").textContent).toContain("Os totais incluem todo o intervalo");
  const saldo = screen.getAllByText("Saldo final projetado")[0].parentElement!;
  expect(within(saldo).getByText(/130,00/)).toBeTruthy();
});

it("conta linhas agrupadas no período em todas as situações sem duplicar os itens de uma nota", () => {
  const nota = { id: "nf-contada", numero: "123", serie: "1", fornecedorNome: "Fornecedor fictício" };
  render(<MovimentacoesView {...props} linhas={[
    { ...pendente, id: "item-1", notaFiscal: nota }, { ...pendente, id: "item-2", notaFiscal: nota },
    { ...pendente, id: "pago", notaFiscal: null, status: "BAIXADO", dataPagamento: "2026-09-11", contaBancariaId: "conta" },
    { ...pendente, id: "fora", dataVencimento: "2026-08-31" },
  ]} avulsas={[]} saldoInicial={0} />);
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-01" } });
  fireEvent.blur(screen.getByLabelText("De"));
  fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-09-30" } });
  fireEvent.blur(screen.getByLabelText("até"));
  const grupo = within(screen.getByRole("group", { name: "Situação das movimentações" }));
  expect(grupo.getByRole("button", { name: "Tudo (2)" })).toBeTruthy();
  expect(grupo.getByRole("button", { name: "Realizados (1)" })).toBeTruthy();
  expect(grupo.getByRole("button", { name: "Pendentes (1)" })).toBeTruthy();
  fireEvent.click(grupo.getByRole("button", { name: "Pendentes (1)" }));
  expect(grupo.getByRole("button", { name: "Tudo (2)" })).toBeTruthy();
});
