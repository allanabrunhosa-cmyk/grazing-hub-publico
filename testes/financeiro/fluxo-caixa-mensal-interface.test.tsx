// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FluxoCaixaView } from "@/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view";
import { lancamentoTeste } from "./dados-movimentacoes";

vi.mock("@/app/(protegido)/financeiro/contas/actions", () => ({ estornarBaixaLancamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/actions", () => ({ obterResumoExclusaoLancamentoAction: vi.fn(), excluirLancamentoAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/lancamentos/lancamento-dialog", () => ({ LancamentoDialog: () => null }));
afterEach(cleanup);

function definirData(nome: string, value: string) {
  fireEvent.change(screen.getByLabelText(nome), { target: { value } });
  fireEvent.blur(screen.getByLabelText(nome));
}

it("consolida meses inteiros, mantém detalhes na origem e permite voltar ao diário", async () => {
  const usuario = userEvent.setup();
  render(<FluxoCaixaView saldoInicialTotal={1000} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]}
    lancamentos={[
      lancamentoTeste({ id: "inicio", descricao: "Pedido fictício", valor: 100, dataVencimento: "2026-09-01", pedidoVendaId: "pedido-ficticio" }),
      lancamentoTeste({ id: "fim", descricao: "Fatura fictícia", valor: 200, dataVencimento: "2026-09-30", faturaId: "fatura-ficticia" }),
      lancamentoTeste({ id: "outubro", valor: 50, dataVencimento: "2026-10-31" }),
    ]} />);
  definirData("De", "2026-09-10");
  definirData("até", "2026-10-10");
  const seletor = screen.getByRole("combobox", { name: "Visualização do fluxo de caixa" });
  await usuario.click(seletor);
  await usuario.click(await screen.findByRole("option", { name: "Mensal" }));
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-09-01");
  expect((screen.getByLabelText("até") as HTMLInputElement).value).toBe("2026-10-31");
  expect(screen.getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Categoria", "set. de 2026", "out. de 2026"]);
  const saldo = screen.getByText("Saldo do Mês").closest("tr")!;
  expect(within(saldo).getAllByRole("cell").slice(1).map(c => c.textContent)).toEqual(["R$ 700,00", "R$ 650,00"]);
  const resultado = screen.getByText("Resultado do Mês").closest("tr")!;
  expect(within(resultado).getAllByRole("cell").slice(1).map(c => c.textContent)).toEqual(["-R$ 300,00", "-R$ 50,00"]);
  await usuario.click(screen.getByRole("button", { name: /Expandir Despesas Operacionais/ }));
  const categoria = screen.getByText("Ocupação", { exact: true }).closest("tr")!;
  await usuario.click(within(categoria).getByRole("cell", { name: /300,00/ }));
  const dialogo = screen.getByRole("dialog");
  expect(within(dialogo).getByText("setembro de 2026")).toBeTruthy();
  expect(within(dialogo).getByText("Pedido fictício")).toBeTruthy();
  expect(within(dialogo).getByText("Fatura fictícia")).toBeTruthy();
  expect(within(dialogo).getByRole("link", { name: "Abrir pedido" }).getAttribute("href")).toBe("/vendas/pedidos/pedido-ficticio");
  expect(within(dialogo).getByRole("link", { name: "Abrir fatura" }).getAttribute("href")).toBe("/financeiro/cartoes/faturas/fatura-ficticia");
  expect(within(dialogo).queryByRole("button", { name: "Excluir" })).toBeNull();
  await usuario.keyboard("{Escape}");
  await waitFor(() => expect(document.contains(dialogo)).toBe(false));
  await usuario.click(screen.getByRole("combobox", { name: "Visualização do fluxo de caixa" }));
  await usuario.click(await screen.findByRole("option", { name: "Diário" }));
  expect(screen.getAllByRole("columnheader")).toHaveLength(63);
  expect(screen.getByText("Saldo do Dia")).toBeTruthy();
});

it("ajusta os novos filtros mensais e mostra mês sem movimento com saldo preservado", async () => {
  const usuario = userEvent.setup();
  render(<FluxoCaixaView saldoInicialTotal={125} lancamentos={[]} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} />);
  await usuario.click(screen.getByRole("combobox", { name: "Visualização do fluxo de caixa" }));
  await usuario.click(await screen.findByRole("option", { name: "Mensal" }));
  definirData("De", "2024-02-15");
  definirData("até", "2024-02-20");
  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2024-02-01");
  expect((screen.getByLabelText("até") as HTMLInputElement).value).toBe("2024-02-29");
  expect(screen.getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Categoria", "fev. de 2024"]);
  const saldo = screen.getByText("Saldo do Mês").closest("tr")!;
  expect(within(saldo).getAllByRole("cell").slice(1).map(c => c.textContent)).toEqual(["R$ 125,00"]);
});

it("mostra o resultado diário com sinal e cor sem incluir a base do saldo", () => {
  const dados = [
    ["receita-1", "RECEITA", "2026-09-01", 100.1], ["despesa-1", "DESPESA", "2026-09-01", 30.1],
    ["receita-2", "RECEITA", "2026-09-02", 10], ["despesa-2", "DESPESA", "2026-09-02", 30],
    ["centavos-1", "RECEITA", "2026-09-03", 0.1], ["centavos-2", "RECEITA", "2026-09-03", 0.2], ["centavos-3", "DESPESA", "2026-09-03", 0.3],
  ] as const;
  render(<FluxoCaixaView saldoInicialTotal={9000} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]}
    lancamentos={dados.map(([id, tipo, dia, valor]) => lancamentoTeste({ id, tipo, valor,
      categoriaId: tipo === "RECEITA" ? "vendas" : "aluguel", categoriaGrupo: tipo === "RECEITA" ? "RECEITA_BRUTA" : "DESPESAS_OPERACIONAIS",
      dataVencimento: dia }))} />);
  definirData("De", "2026-09-01"); definirData("até", "2026-09-03");
  const linha = screen.getByText("Resultado do Dia").closest("tr")!;
  const valores = within(linha).getAllByRole("cell").slice(1);
  expect(valores.map(c => c.textContent)).toEqual(["+R$ 70,00", "-R$ 20,00", "R$ 0,00", "+R$ 50,00"]);
  expect(valores[0].className).toContain("text-success");
  expect(valores[1].className).toContain("text-destructive");
  expect(valores[2].className).toContain("text-muted-foreground");
  expect(valores.every(c => c.className.includes("text-xs"))).toBe(true);
  const saldo = screen.getByText("Saldo do Dia").closest("tr")!;
  expect(saldo.nextElementSibling).toBe(linha);
  expect(within(saldo).getAllByRole("cell").at(-1)?.textContent).toBe("R$ 9.050,00");
  expect(screen.getAllByRole("columnheader").at(-1)?.textContent).toBe("Total");
});

it("retira Total de todos os níveis mensais e preserva expansão até o neto", async () => {
  const usuario = userEvent.setup();
  render(<FluxoCaixaView saldoInicialTotal={100} categorias={[]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]}
    planoContas={[
      { id: "pai", nome: "Pessoal", grupo: "DESPESAS_OPERACIONAIS" },
      { id: "filho", nome: "Pessoal › Benefícios", grupo: "DESPESAS_OPERACIONAIS", paiId: "pai" },
      { id: "neto", nome: "Pessoal › Benefícios › Alimentação", grupo: "DESPESAS_OPERACIONAIS", paiId: "filho" },
    ]} lancamentos={[lancamentoTeste({ id: "beneficio", categoriaId: "neto", categoriaNome: "Pessoal › Benefícios › Alimentação", valor: 77, dataVencimento: "2026-09-20" })]} />);
  definirData("De", "2026-09-01"); definirData("até", "2026-09-30");
  await usuario.click(screen.getByRole("combobox", { name: "Visualização do fluxo de caixa" }));
  await usuario.click(await screen.findByRole("option", { name: "Mensal" }));
  await usuario.click(screen.getByRole("button", { name: /Expandir Despesas Operacionais/ }));
  await usuario.click(screen.getByRole("button", { name: "Expandir Pessoal" }));
  await usuario.click(screen.getByRole("button", { name: "Expandir Pessoal › Benefícios" }));
  expect(screen.getByText("Alimentação", { exact: true })).toBeTruthy();
  const tabela = screen.getByRole("table", { name: "Fluxo de caixa" });
  expect(within(tabela).getAllByRole("columnheader")).toHaveLength(2);
  for (const linha of Array.from(tabela.querySelectorAll("tbody tr"))) {
    const celulas = Array.from(linha.querySelectorAll("td"));
    if (celulas.length === 1) expect(celulas[0].colSpan).toBe(2);
    else expect(celulas).toHaveLength(2);
  }
  const resultado = screen.getByText("Resultado do Mês").closest("tr")!;
  expect(within(resultado).getAllByRole("cell")[1].textContent).toBe("-R$ 77,00");
});
