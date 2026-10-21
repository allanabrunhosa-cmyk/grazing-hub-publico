// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import { insumoStatus } from "../cadastros/dados";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/producao/etiquetas/actions", () => ({ salvarConfiguracaoProdutoEtiquetaAction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/(protegido)/insumos/actions", () => ({ deleteInsumoAction: vi.fn() }));
vi.mock("@/lib/insumos/consulta-porcoes-cliente", () => ({ consultarPorcoesNoCliente: vi.fn(async () => ({ porcoes: [], podeCadastrar: false })), salvarPorcaoAction: vi.fn() }));
vi.mock("@/app/(protegido)/status-cadastros-actions", () => ({ alterarStatusInsumoAction: vi.fn() }));

afterEach(cleanup);

it("separa marca em coluna e mantém a especificação abaixo do nome", () => {
  render(
    <InsumosTable
      insumos={[{ ...insumoStatus, especificacao: "Tipo 1, força W300", marca: "Farina", marcasHomologadas: ["Farina", "Caputo"] }]}
      categorias={[]}
      centrosCusto={[]}
      fornecedores={[]}
      todosInsumos={[]}
    />,
  );

  expect(screen.getByRole("columnheader", { name: /Marca/i })).toBeTruthy();
  const linha = screen.getByRole("row", { name: /Farinha de trigo.*Tipo 1, força W300.*Farina.*Caputo/i });
  const celulas = within(linha).getAllByRole("cell");
  expect(within(celulas[0]).getByText("Tipo 1, força W300").className).toContain("text-muted-foreground");
  expect(within(celulas[1]).getByText("Farina")).toBeTruthy();
  expect(within(celulas[1]).getByText("Caputo")).toBeTruthy();
});
it("mostra todos os fornecedores homologados e busca por insumo, marca ou categoria", async () => {
  const usuario = userEvent.setup();
  render(<InsumosTable insumos={[
    { ...insumoStatus, marcasHomologadas: ["Grão Bom"], categoria: { id: "c1", nome: "Panificação" }, fornecedoresHomologados: [{ id: "f1", nome: "Distribuidora Exemplo" }, { id: "f2", nome: "Fornecedor Alternativo" }] },
    { ...insumoStatus, id: "sal", nome: "Sal fino", marcasHomologadas: [], categoria: null, fornecedoresHomologados: [] },
  ]} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} />);
  expect(screen.getByRole("columnheader", { name: /Fornecedores/ })).toBeTruthy();
  expect(screen.getByText("Distribuidora Exemplo, Fornecedor Alternativo")).toBeTruthy();
  const busca = screen.getByRole("textbox", { name: "Buscar insumo, marca, categoria ou fornecedor" });
  for (const termo of ["farinha", "grao bom", "panificacao", "DISTRIBUIDORA", "alternativo"]) {
    await usuario.clear(busca);
    await usuario.type(busca, termo);
    expect(screen.getByText("Farinha de trigo")).toBeTruthy();
    expect(screen.queryByText("Sal fino")).toBeNull();
  }
  await usuario.click(screen.getByRole("button", { name: "Limpar busca" }));
  expect(screen.getByText("Sal fino")).toBeTruthy();
});
