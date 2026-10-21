// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DreView } from "@/app/(protegido)/financeiro/dre-view";
import { FluxoCaixaView } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view";
import { lancamentoTeste } from "./dados-movimentacoes";
const exportar = vi.hoisted(() => ({ pdf: vi.fn(), xlsx: vi.fn() }));
vi.mock("@/lib/financeiro/exportacao-pdf", () => ({ baixarPdfFinanceiro: exportar.pdf }));
vi.mock("@/lib/financeiro/exportacao-xlsx", () => ({ baixarXlsxFinanceiro: exportar.xlsx }));
vi.mock("@/app/(protegido)/financeiro/contas/actions", () => ({ estornarBaixaLancamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({ obterResumoExclusaoLancamentoAction: vi.fn(), excluirLancamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/lancamento-dialog", () => ({ LancamentoDialog: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function periodo() {
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-10" } });
  fireEvent.blur(screen.getByLabelText("De"));
  fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-09-10" } });
  fireEvent.blur(screen.getByLabelText("até"));
}
it.each(["PDF", "XLSX"])("DRE exporta %s com o período e modo atuais", async formato => {
  const usuario = userEvent.setup();
  render(<DreView lancamentos={[lancamentoTeste({ valor: 123.45, status: "BAIXADO", dataPagamento: "2026-09-10T12:00:00Z" })]} />);
  periodo();
  await usuario.click(screen.getByRole("button", { name: "Caixa" }));
  await usuario.click(screen.getByRole("button", { name: "Exportar" }));
  await usuario.click(await screen.findByRole("menuitem", { name: formato }));
  const baixar = formato === "PDF" ? exportar.pdf : exportar.xlsx;
  await waitFor(() => expect(baixar).toHaveBeenCalledOnce());
  const r = baixar.mock.calls[0][0];
  expect(r.filtros).toBe("Período: 10/09/2026 a 10/09/2026 | Caixa");
  expect(r.linhas.find((l: { nome: string }) => l.nome === "Ocupação").valores).toEqual([123.45]);
});
it("Fluxo exporta categorias e lançamentos mesmo sem expandir nenhum grupo", async () => {
  const usuario = userEvent.setup();
  render(<FluxoCaixaView saldoInicialTotal={0} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]}
    lancamentos={[lancamentoTeste({ valor: 77 }), lancamentoTeste({ id: "fora", dataVencimento: "2026-09-11", valor: 500 })]} />);
  periodo();
  expect(screen.queryByText("Ocupação", { exact: true })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Exportar" }));
  await usuario.click(await screen.findByRole("menuitem", { name: "XLSX" }));
  await waitFor(() => expect(exportar.xlsx).toHaveBeenCalledOnce());
  const r = exportar.xlsx.mock.calls[0][0];
  expect(r.colunas).toEqual(["10/09/2026", "Total do período"]);
  expect(r.linhas.find((l: { nome: string }) => l.nome === "Ocupação").valores).toEqual([-77, -77]);
  expect(r.linhas.at(-1)).toMatchObject({ nome: "Resultado do Dia", valores: [-77, -77] });
  expect(r.detalhes).toHaveLength(1);
});

it.each(["PDF", "XLSX"])("Fluxo mensal exporta %s sem Total e com o resultado de cada mês", async formato => {
  const usuario = userEvent.setup();
  render(<FluxoCaixaView saldoInicialTotal={1000} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]}
    lancamentos={[
      lancamentoTeste({ id: "receita", tipo: "RECEITA", categoriaId: "vendas", categoriaNome: "Vendas", categoriaGrupo: "RECEITA_BRUTA", valor: 100 }),
      lancamentoTeste({ id: "despesa-setembro", valor: 77, dataVencimento: "2026-09-11" }),
      lancamentoTeste({ id: "despesa-outubro", valor: 200, dataVencimento: "2026-10-01" }),
      lancamentoTeste({ id: "fora", valor: 500, dataVencimento: "2026-11-01" }),
    ]} />);
  periodo();
  fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-10-10" } });
  fireEvent.blur(screen.getByLabelText("até"));
  await usuario.click(screen.getByRole("combobox", { name: "Visualização do fluxo de caixa" }));
  await usuario.click(await screen.findByRole("option", { name: "Mensal" }));
  await usuario.click(screen.getByRole("button", { name: "Exportar" }));
  await usuario.click(await screen.findByRole("menuitem", { name: formato }));
  const baixar = formato === "PDF" ? exportar.pdf : exportar.xlsx;
  await waitFor(() => expect(baixar).toHaveBeenCalledOnce());
  const r = baixar.mock.calls[0][0];
  expect(r.agrupamentoFluxo).toBe("mensal");
  expect(r.colunas).toEqual(["09/2026", "10/2026"]);
  expect(r.linhas.every((l: { valores: number[] }) => l.valores.length === 2)).toBe(true);
  expect(r.linhas.at(-2)).toMatchObject({ nome: "Saldo do Mês", valores: [1023, 823] });
  expect(r.linhas.at(-1)).toMatchObject({ nome: "Resultado do Mês", valores: [23, -200] });
  expect(r.detalhes).toHaveLength(3);
});
