// @vitest-environment jsdom
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consultar: vi.fn(), excluir: vi.fn(), corrigir: vi.fn(), refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push, replace: mocks.replace }) }));
vi.mock("@/app/(protegido)/inventario/entradas/actions", () => ({ consultarEntradaAvulsaAction: mocks.consultar, excluirEntradaAvulsaAction: mocks.excluir, corrigirEntradaAvulsaAction: mocks.corrigir }));
import { EntradasHistorico } from "@/app/(protegido)/inventario/entradas/entradas-historico";
import { detalhe, insumos, locais, linhaHistorico } from "../visual/estoque-entradas-dados";
const dados = { linhas: [linhaHistorico], total: 1, pagina: 1, paginas: 1, responsaveis: [detalhe.responsavel] };
beforeEach(() => { vi.clearAllMocks(); mocks.consultar.mockResolvedValue({ detalhe, insumos, locais }); mocks.excluir.mockResolvedValue({ erro: "Saldo insuficiente. Nenhum estorno aplicado." }); mocks.corrigir.mockResolvedValue({ ok: true, id: detalhe.id }); });
afterEach(cleanup);
it("exibe colunas na ordem solicitada e abre popup preenchido direto pela edição", async () => {
  const user = userEvent.setup(); render(<EntradasHistorico filtros={{}} dados={dados} podeAdicionar podeEditar podeExcluir />);
  expect(screen.getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Data de lançamento", "Fornecedor", "Itens com quantidade", "Valor total", "Ações"]);
  expect(screen.getByRole("link", { name: "123" })).toBeDefined();
  expect(screen.getByText(/Uva verde · 4 kg/)).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Editar entrada 123" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("Quantidade do item 1")).toHaveProperty("value", "2");
  expect(within(dialog).queryByLabelText("Unidade de entrada")).toBeNull();
  await user.click(within(dialog).getByRole("button", { name: "Salvar correção" }));
  expect(mocks.refresh).toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
});
it("exige confirmação e motivo; conserva a tela se o servidor bloquear a exclusão", async () => {
  const user = userEvent.setup(); render(<EntradasHistorico filtros={{}} dados={dados} podeAdicionar podeExcluir />);
  await user.click(screen.getByRole("button", { name: "Excluir entrada 123" }));
  const dialog = await screen.findByRole("dialog");
  expect(mocks.excluir).not.toHaveBeenCalled();
  const confirmar = within(dialog).getByRole("button", { name: "Confirmar exclusão da entrada" });
  expect(confirmar).toHaveProperty("disabled", true);
  await user.type(within(dialog).getByLabelText("Motivo da exclusão"), "Registro duplicado na conferência.");
  await user.click(confirmar);
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", "Saldo insuficiente. Nenhum estorno aplicado.");
  expect(mocks.excluir).toHaveBeenCalledWith(expect.objectContaining({ id: detalhe.id, versao: 2, motivo: "Registro duplicado na conferência." }));
  const chave = mocks.excluir.mock.calls[0][0].chave;
  await waitFor(() => expect(confirmar).toHaveProperty("disabled", false));
  await user.click(confirmar); await waitFor(() => expect(mocks.excluir).toHaveBeenCalledTimes(2)); expect(mocks.excluir.mock.calls[1][0].chave).toBe(chave);
});
it("respeita permissões e desabilita ações de registros encerrados", () => {
  const { rerender } = render(<EntradasHistorico filtros={{}} dados={dados} podeAdicionar={false} />);
  expect(screen.queryByRole("button", { name: "Editar entrada 123" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Excluir entrada 123" })).toBeNull();
  rerender(<EntradasHistorico filtros={{}} dados={{ ...dados, linhas: [{ ...linhaHistorico, situacao: "Excluída" }] }} podeAdicionar={false} podeEditar podeExcluir />);
  expect(screen.getByRole("button", { name: "Editar entrada 123" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Excluir entrada 123" })).toHaveProperty("disabled", true);
});

it("usa busca única e período; aplica consulta ao servidor e reinicia a paginação", async () => {
  const user = userEvent.setup();
  render(<EntradasHistorico filtros={{ pagina: "3", de: "2026-10-01", ate: "2026-10-12" }} dados={dados} podeAdicionar />);
  expect(screen.queryByLabelText("Insumo / preparação")).toBeNull();
  expect(screen.queryByLabelText("Responsável")).toBeNull();
  expect(screen.queryByText("Corrigida")).toBeNull();
  expect(screen.queryByRole("button", { name: "Pesquisar" })).toBeNull();
  await user.type(screen.getByRole("textbox", { name: "Buscar nas entradas avulsas" }), "Fornecedor Uva");
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/inventario/entradas?de=2026-10-01&ate=2026-10-12&busca=Fornecedor+Uva", { scroll: false }));
  await user.click(screen.getByRole("button", { name: "Limpar busca" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenLastCalledWith("/inventario/entradas?de=2026-10-01&ate=2026-10-12", { scroll: false }));
});
it("oculta rótulo de registrada e conserva apenas as ações na última coluna", () => {
  render(<EntradasHistorico filtros={{}} dados={{ ...dados, linhas: [{ ...linhaHistorico, situacao: "Registrada" }] }} podeAdicionar podeEditar podeExcluir />);
  expect(screen.queryByText("Registrada")).toBeNull();
  const celula = screen.getAllByRole("cell").at(-1)!;
  expect(within(celula).getAllByRole("button").map(b => b.getAttribute("aria-label"))).toEqual(["Editar entrada 123", "Excluir entrada 123"]);
});
