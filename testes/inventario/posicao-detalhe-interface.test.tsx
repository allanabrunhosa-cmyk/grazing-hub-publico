// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PosicaoAtualTable } from "@/app/(protegido)/inventario/posicao-atual-table";
import { obterMovimentacoesInsumoAction } from "@/app/(protegido)/inventario/historico-insumo-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/inventario/perdas/perda-dialog", () => ({ PerdaDialog: () => null }));
vi.mock("@/app/(protegido)/inventario/historico-insumo-actions", () => ({ obterMovimentacoesInsumoAction: vi.fn() }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const linha = {
  insumoId: "arroz",
  nome: "Arroz branco",
  tipo: "INSUMO" as const,
  marca: null,
  marcasHomologadas: ["Grão Bom"],
  categoriaNome: "Cereais",
  fornecedoresHomologados: [{ id: "distribuidora", nome: "Distribuidora São José" }],
  unidade: "KG" as const,
  estoqueMinimo: 5,
  estoqueMaximo: 30,
  custoMedio: 6,
  saldosPorLocal: { principal: 13 },
};

it("abre as movimentações do insumo e mostra o caminho até o saldo atual", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.mocked(obterMovimentacoesInsumoAction).mockResolvedValue({
    dados: {
      insumoId: "arroz",
      insumoNome: "Arroz branco",
      unidade: "KG",
      localNome: null,
      dataReferencia: null,
      saldoReferencia: 13,
      saldoAnteriorAoTrecho: 0,
      temMais: true,
      limite: 50,
      movimentacoes: [
        { id: "entrada", createdAt: "2026-09-01T12:00:00.000Z", localNome: "Principal", tipo: "ENTRADA_COMPRA", quantidade: 15, saldo: 15, observacao: "Compra inicial", responsavelNome: "Allan" },
        { id: "saida", createdAt: "2026-09-02T12:00:00.000Z", localNome: "Principal", tipo: "SAIDA_CONSUMO", quantidade: 2, saldo: 13, observacao: null, responsavelNome: null },
      ],
    },
  });

  const usuario = userEvent.setup();
  render(<PosicaoAtualTable linhas={[linha]} locais={[{ id: "principal", nome: "Principal" }]} dataSelecionada="2026-09-11" hoje="2026-09-11" isHistorico={false} />);
  expect(screen.getByLabelText("Valor total em estoque").textContent).toMatch(/R\$\s78,00/);
  await usuario.click(screen.getByRole("button", { name: "Abrir movimentações de Arroz branco" }));

  const lista = await screen.findByRole("list", { name: "Últimas movimentações de Arroz branco" });
  expect(obterMovimentacoesInsumoAction).toHaveBeenCalledWith({ insumoId: "arroz", localId: null, dataReferencia: null });
  expect(screen.getByText("Saldo atual").parentElement?.textContent).toContain("13 kg");
  expect(screen.getByText(/Saldo antes deste trecho/).textContent).toContain("0 kg");
  expect(within(lista).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    expect.stringContaining("Compra inicial"),
    expect.stringContaining("Saldo: 13 kg"),
  ]);
  expect(screen.getByText("Mostrando as 50 movimentações mais recentes. Existem registros anteriores.")).toBeTruthy();
});

it("mostra o estoque máximo e filtra os itens abaixo do mínimo no local escolhido", async () => {
  const usuario = userEvent.setup();
  render(<PosicaoAtualTable linhas={[linha, { ...linha, insumoId: "sal", nome: "Sal fino", saldosPorLocal: { principal: 2, reserva: 8 }, estoqueMaximo: null }]}
    locais={[{ id: "principal", nome: "Principal" }, { id: "reserva", nome: "Reserva" }]}
    dataSelecionada="2026-09-11" hoje="2026-09-11" isHistorico={false} />);
  expect(screen.getByText("Máximo")).toBeTruthy();
  expect(screen.getByText("30 kg")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Abaixo do mínimo/ }).textContent).toContain("0");
  await usuario.click(screen.getByRole("combobox", { name: "Local de estoque" }));
  await usuario.click(await screen.findByRole("option", { name: /^Principal \(\d[\d.]*\)$/ }));
  const alerta = screen.getByRole("button", { name: /Abaixo do mínimo/ });
  expect(alerta.textContent).toContain("1");
  await usuario.click(alerta);
  expect(screen.getByText("Sal fino")).toBeTruthy();
  expect(screen.queryByText("Arroz branco")).toBeNull();
  expect(screen.getByRole("button", { name: "Todos (1)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Insumo (1)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Preparações (0)" })).toBeTruthy();
  await usuario.click(screen.getByRole("combobox", { name: "Local de estoque" }));
  await usuario.click(await screen.findByRole("option", { name: /^Todos os locais \(\d[\d.]*\)$/ }));
  expect(screen.getByRole("button", { name: "Todos (0)" })).toBeTruthy();
});

it("filtra insumos, preparações ou todos como no cadastro", async () => {
  const usuario = userEvent.setup();
  render(<PosicaoAtualTable linhas={[linha, { ...linha, insumoId: "molho", nome: "Molho pronto", tipo: "PRODUTO_INTERMEDIARIO" }]}
    locais={[{ id: "principal", nome: "Principal" }]} dataSelecionada="2026-09-11" hoje="2026-09-11" isHistorico={false} />);
  expect(screen.getByText("Arroz branco")).toBeTruthy();
  expect(screen.getByText("Molho pronto")).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Insumo (1)", pressed: false }));
  expect(screen.getByText("Arroz branco")).toBeTruthy();
  expect(screen.queryByText("Molho pronto")).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Preparações (1)" }));
  expect(screen.queryByText("Arroz branco")).toBeNull();
  expect(screen.getByText("Molho pronto")).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Todos (2)" }));
  expect(screen.getByText("Arroz branco")).toBeTruthy();
  expect(screen.getByText("Molho pronto")).toBeTruthy();
});
it("busca por nome, marca e categoria sem acentos e mantém o filtro de tipo", async () => {
  const usuario = userEvent.setup();
  render(<PosicaoAtualTable linhas={[linha, { ...linha, insumoId: "molho", nome: "Molho pronto", tipo: "PRODUTO_INTERMEDIARIO", marcasHomologadas: [], categoriaNome: "Preparações", fornecedoresHomologados: [] }]}
    locais={[{ id: "principal", nome: "Principal" }]} dataSelecionada="2026-09-11" hoje="2026-09-11" isHistorico={false} />);
  expect(screen.getByRole("columnheader", { name: /Fornecedores/ })).toBeTruthy();
  expect(screen.getByText("Distribuidora São José")).toBeTruthy();
  const busca = screen.getByRole("textbox", { name: "Buscar insumo, marca, categoria ou fornecedor" });
  for (const termo of ["arroz", "grao bom", "cereais", "DISTRIBUIDORA", "sao jose"]) {
    await usuario.clear(busca);
    await usuario.type(busca, termo);
    expect(screen.getByText("Arroz branco")).toBeTruthy();
    expect(screen.queryByText("Molho pronto")).toBeNull();
  }
  expect(screen.getByRole("button", { name: "Todos (1)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Insumo (1)" })).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Preparações (0)" }));
  expect(screen.queryByText("Arroz branco")).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Limpar busca" }));
  expect(screen.getByText("Molho pronto")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Todos (2)" })).toBeTruthy();
});
