// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MovimentacoesTable } from "@/app/(protegido)/inventario/movimentacoes/movimentacoes-table";
import type { MovimentacaoRow } from "@/app/(protegido)/inventario/types";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import type { Excecoes, Permissoes } from "@/lib/permissoes/catalogo";
afterEach(cleanup);
const linhas: MovimentacaoRow[] = [
  { id: "2", createdAt: "2026-09-03T02:30:00.000Z", insumoNome: "Arroz", localNome: "Principal", unidade: "KG", tipo: "SAIDA_PERDA", quantidade: 2, saldo: 8, observacao: null },
  { id: "1", createdAt: "2026-09-01T12:00:00.000Z", insumoNome: "Arroz", localNome: "Principal", unidade: "KG", tipo: "ENTRADA_COMPRA", quantidade: 10, saldo: 10, observacao: null },
];
it("filtra por data e direção preservando saldo e oferece limpar datas", () => {
  render(<MovimentacoesTable linhas={linhas} />);
  const tabela = within(screen.getByRole("table"));
  expect(tabela.getByText("Saldo")).toBeTruthy();
  expect(screen.queryByText("Valor / Pagamento")).toBeNull();
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-02" } });
  fireEvent.blur(screen.getByLabelText("De"));
  fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-09-02" } });
  fireEvent.blur(screen.getByLabelText("até"));
  expect(tabela.getAllByRole("row")).toHaveLength(2);
  expect(tabela.getByText("8 kg")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^Entradas \(\d[\d.]*\)$/ }));
  expect(screen.getByText("Nenhuma movimentação encontrada.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Limpar datas" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /^Todas \(\d[\d.]*\)$/ }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
});

it.each([
  { nome: "administrador", admin: true, permissoes: {}, excecoes: {}, visivel: true },
  { nome: "entrada autorizada", admin: false, permissoes: { "inventario.entrada": ["visualizar", "adicionar"] }, excecoes: {}, visivel: true },
  { nome: "somente leitura", admin: false, permissoes: { "inventario.entrada": ["visualizar"] }, excecoes: {}, visivel: false },
  { nome: "somente inventário", admin: false, permissoes: { inventario: ["visualizar", "adicionar"] }, excecoes: {}, visivel: false },
  { nome: "adição sem visualizar", admin: false, permissoes: { "inventario.entrada": ["adicionar"] }, excecoes: {}, visivel: false },
  { nome: "veto individual", admin: false, permissoes: { "inventario.entrada": ["visualizar", "adicionar"] }, excecoes: { "inventario.entrada": { adicionar: false } }, visivel: false },
  { nome: "permissão individual", admin: false, permissoes: { "inventario.entrada": ["visualizar"] }, excecoes: { "inventario.entrada": { adicionar: true } }, visivel: true },
])("acesso à entrada avulsa em Movimentações: $nome", ({ admin, permissoes, excecoes, visivel }) => {
  render(<ProvedorAcesso acesso={{ admin, permissoes: permissoes as Permissoes, excecoes: excecoes as Excecoes }}>
    <MovimentacoesTable linhas={[]} />
  </ProvedorAcesso>);
  const atalho = screen.queryByRole("link", { name: "Entrada avulsa" });
  expect(Boolean(atalho)).toBe(visivel);
  if (visivel) expect(atalho?.getAttribute("href")).toBe("/inventario/entrada-avulsa");
  expect(screen.getByText("Nenhuma movimentação encontrada.")).toBeTruthy();
});

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-18T15:00:00Z")); });
afterEach(() => vi.useRealTimers());

it("posiciona o histórico ao lado da entrada avulsa e permite consultar sem adicionar", () => {
  const { rerender } = render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><MovimentacoesTable linhas={[]} /></ProvedorAcesso>);
  const grupo = screen.getByRole("group", { name: "Entradas avulsas" });
  expect(within(grupo).getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/inventario/entrada-avulsa", "/inventario/entradas"]);
  expect(within(grupo).getByRole("link", { name: "Histórico de entradas avulsas" }).textContent).toBe("");
  rerender(<ProvedorAcesso acesso={{ admin: false, permissoes: { inventario: ["visualizar"] }, excecoes: {} }}><MovimentacoesTable linhas={[]} /></ProvedorAcesso>);
  expect(screen.queryByRole("link", { name: "Entrada avulsa" })).toBeNull();
  expect(screen.getByRole("link", { name: "Histórico de entradas avulsas" })).toBeDefined();
});
