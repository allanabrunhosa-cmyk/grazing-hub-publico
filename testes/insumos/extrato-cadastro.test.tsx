// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsumoDialog } from "@/app/(protegido)/insumos/insumo-dialog";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import { insumoStatus } from "../cadastros/dados";
import type { InsumoRow } from "@/app/(protegido)/insumos/types";

const sim = vi.hoisted(() => ({ salvar: vi.fn(), consultar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/(protegido)/insumos/actions", () => ({ saveInsumoAction: sim.salvar, createCategoriaAction: vi.fn(), createCentroCustoAction: vi.fn() }));
vi.mock("@/app/(protegido)/insumos/movimentacoes-actions", () => ({ consultarMovimentacoesItemAction: sim.consultar }));
beforeEach(() => {
  vi.clearAllMocks();
  sim.consultar.mockResolvedValue({ dados: { linhas: [], total: 0, pagina: 1, paginas: 1 } });
});
afterEach(cleanup);

function cadastro(insumo: InsumoRow | undefined, estoque = true) {
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { insumos: ["visualizar", "editar"], inventario: estoque ? ["visualizar"] : [] }, excecoes: {} }}>
    <InsumoDialog insumo={insumo} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} trigger={<Button>Abrir cadastro</Button>} />
  </ProvedorAcesso>);
}

it.each(["INSUMO", "PRODUTO_INTERMEDIARIO"] as const)("abre o extrato de %s no cadastro e conserva o rascunho ao voltar", async tipo => {
  const usuario = userEvent.setup();
  cadastro({ ...insumoStatus, tipo });
  await usuario.click(screen.getByRole("button", { name: "Abrir cadastro" }));
  const nome = screen.getByLabelText("Nome Oficial *");
  await usuario.clear(nome); await usuario.type(nome, "Nome em edição fictício");
  expect(sim.consultar).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("tab", { name: "Movimentações" }));
  await screen.findByText("Nenhuma movimentação neste período.");
  expect(sim.consultar).toHaveBeenCalledWith(expect.objectContaining({ insumoId: insumoStatus.id, pagina: 1, ordem: "desc" }));
  const painel = screen.getByRole("tabpanel");
  expect(within(painel).queryByRole("button", { name: "Salvar alterações" })).toBeNull();
  await usuario.click(screen.getByRole("tab", { name: "Dados do item" }));
  expect(screen.getByLabelText("Nome Oficial *")).toHaveProperty("value", "Nome em edição fictício");
  expect(sim.salvar).not.toHaveBeenCalled();
}, 15000);

it("não oferece consulta de estoque sem a permissão ou antes do cadastro existir", async () => {
  const usuario = userEvent.setup();
  cadastro(insumoStatus, false);
  await usuario.click(screen.getByRole("button", { name: "Abrir cadastro" }));
  expect(screen.queryByRole("tab", { name: "Movimentações" })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  cleanup(); cadastro(undefined);
  await usuario.click(screen.getByRole("button", { name: "Abrir cadastro" }));
  expect(screen.queryByRole("tab", { name: "Movimentações" })).toBeNull();
  expect(sim.consultar).not.toHaveBeenCalled();
});
