// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DreView } from "@/app/(protegido)/financeiro/dre-view";
import { FluxoCaixaView } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view";
import { periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { lancamentoTeste } from "./dados-movimentacoes";
const acoes = vi.hoisted(() => ({ estornar: vi.fn(), consultar: vi.fn(), excluir: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/contas/actions", () => ({ estornarBaixaLancamentoAction: acoes.estornar }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({ obterResumoExclusaoLancamentoAction: acoes.consultar, excluirLancamentoAction: acoes.excluir }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/lancamento-dialog", () => ({ LancamentoDialog: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(["PENDENTE", "BAIXADO"] as const)("pedido %s conserva tratamento na origem dentro do caixa", async status => {
  const usuario = userEvent.setup(), dia = periodoMesAteHoje().ate;
  render(<FluxoCaixaView saldoInicialTotal={0} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} lancamentos={[
    lancamentoTeste({ pedidoVendaId: "pedido-ficticio", valor: 37, status, dataCompetencia: `${dia}T12:00:00Z`, dataVencimento: `${dia}T12:00:00Z`, dataPagamento: status === "BAIXADO" ? `${dia}T12:00:00Z` : null }),
  ]} />);
  await usuario.click(screen.getByRole("button", { name: /Expandir Despesas Operacionais/i }));
  await usuario.click(within(screen.getByText("Ocupação", { exact: true }).closest("tr")!).getAllByRole("cell", { name: /37,00/ })[0]);
  const detalhe = screen.getByRole("dialog");
  expect(within(detalhe).getByRole("link", { name: "Abrir pedido" }).getAttribute("href")).toBe("/vendas/pedidos/pedido-ficticio");
  expect(within(detalhe).queryByRole("button", { name: "Excluir" })).toBeNull();
  expect(within(detalhe).queryByRole("button", { name: "Cancelar baixa" })).toBeNull();
  expect(acoes.estornar).not.toHaveBeenCalled();
});
it("inicia recolhido e revela cada um dos três níveis separadamente, também pelo teclado", async () => {
  const usuario = userEvent.setup();
  render(<FluxoCaixaView saldoInicialTotal={0} lancamentos={[]} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} planoContas={[
    { id: "pai", nome: "Pessoal", grupo: "DESPESAS_OPERACIONAIS" },
    { id: "filho", nome: "Pessoal › Benefícios", grupo: "DESPESAS_OPERACIONAIS", paiId: "pai" },
    { id: "neto", nome: "Pessoal › Benefícios › Alimentação", grupo: "DESPESAS_OPERACIONAIS", paiId: "filho" },
  ]} />);
  const grupo = screen.getByRole("button", { name: /Expandir Despesas Operacionais/i });
  expect(grupo.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Pessoal", { exact: true })).toBeNull();
  await usuario.click(grupo);
  const pai = screen.getByRole("button", { name: "Expandir Pessoal" });
  expect(screen.queryByText("Benefícios", { exact: true })).toBeNull();
  pai.focus(); await usuario.keyboard("{Enter}");
  await usuario.click(screen.getByRole("button", { name: "Expandir Pessoal › Benefícios" }));
  expect(screen.getByText("Alimentação", { exact: true })).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Recolher Pessoal › Benefícios" }));
  expect(screen.queryByText("Alimentação", { exact: true })).toBeNull();
});

it("fluxo e DRE iniciam no dia 1 do mês até hoje, inclusive na virada do ano", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 0, 5, 12));
  try {
    render(<><FluxoCaixaView saldoInicialTotal={0} lancamentos={[]} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} /><DreView lancamentos={[]} /></>);
    expect(screen.getAllByLabelText("De").map(i => (i as HTMLInputElement).value)).toEqual(["2026-01-01", "2026-01-01"]);
    expect(screen.getAllByLabelText("até").map(i => (i as HTMLInputElement).value)).toEqual(["2026-01-05", "2026-01-05"]);
  } finally { vi.useRealTimers(); }
});

it.each(["PENDENTE", "BAIXADO"] as const)("suspende o resumo ao abrir a confirmação de %s e o restaura ao voltar", async status => {
  const usuario = userEvent.setup();
  const dia = periodoMesAteHoje().ate;
  acoes.consultar.mockResolvedValue({ descricao: "Movimentação fictícia", grupo: null, pendentes: 1, realizados: 0 });
  render(<FluxoCaixaView saldoInicialTotal={0} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} lancamentos={[
    lancamentoTeste({ id: "lancamento-ficticio", descricao: "Movimentação fictícia", valor: 37, status, dataCompetencia: `${dia}T12:00:00.000Z`, dataVencimento: `${dia}T12:00:00.000Z`, dataPagamento: status === "BAIXADO" ? `${dia}T12:00:00.000Z` : null }),
  ]} />);
  await usuario.click(screen.getByRole("button", { name: /Expandir Despesas Operacionais/i }));
  const linha = screen.getByText("Ocupação", { exact: true }).closest("tr")!;
  await usuario.click(within(linha).getAllByRole("cell", { name: /37,00/ })[0]);
  const resumo = screen.getByRole("dialog");
  await usuario.click(within(resumo).getByRole("button", { name: status === "PENDENTE" ? "Excluir" : "Cancelar baixa" }));
  await screen.findByRole("dialog", { name: status === "PENDENTE" ? "Excluir movimentação?" : "Cancelar a baixa deste lançamento?" });
  await waitFor(() => expect(resumo.getAttribute("data-dialogo-suspenso")).toBe("true"));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(document.contains(resumo)).toBe(true);
  await usuario.click(screen.getByRole("button", { name: "Voltar" }));
  await waitFor(() => expect(resumo.hasAttribute("data-dialogo-suspenso")).toBe(false));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(resumo).getByText("Movimentação fictícia")).toBeTruthy();
  expect(acoes.estornar).not.toHaveBeenCalled();
  expect(acoes.excluir).not.toHaveBeenCalled();
});
