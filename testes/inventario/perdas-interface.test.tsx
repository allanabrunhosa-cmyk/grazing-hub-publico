// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerdaDialog } from "@/app/(protegido)/inventario/perdas/perda-dialog";
import { PerdasTable } from "@/app/(protegido)/inventario/perdas/perdas-table";
import { ExcluirPerdaDialog } from "@/app/(protegido)/inventario/perdas/excluir-perda-dialog";
vi.mock("server-only", () => ({}));
import type { PerdaExcluidaRow, PerdaRow } from "@/app/(protegido)/inventario/types";

const simulados = vi.hoisted(() => ({ registrar: vi.fn(), excluir: vi.fn() }));
vi.mock("@/app/(protegido)/inventario/perdas/actions", () => ({ registrarPerdaAction: simulados.registrar, excluirPerdaAction: simulados.excluir }));
const perda: PerdaRow = { id: "perda", data: "2026-09-11T12:00:00Z", insumoNome: "Queijo brie", localNome: "Câmara fria", motivo: "OUTRO", motivoPersonalizado: "Refrigeração interrompida", quantidade: 1.25, unidade: "KG", valorEstimado: 90, observacao: "Conferido pela equipe", responsavelNome: "Mariana Souza" };
const excluida: PerdaExcluidaRow = { ...perda, excluidaEm: "2026-09-11T15:00:00Z", motivoExclusao: "Registro duplicado", responsavelExclusaoNome: "Allan", quantidadeEstornada: 1.25, unidadeEstornada: "KG" };

it.each([["0,5", "UN", 0.5], ["0,01", "KG", 0.01], ["0,0875", "KG", 0.0875], ["0,00000001", "KG", 0.00000001]] as const)(
  "envia a perda %s %s sem limitar as casas decimais", async (texto, unidade, quantidade) => {
    const usuario = userEvent.setup();
    render(<PerdaDialog insumos={[{ id: "insumo", nome: "Insumo de teste", unidade, custoMedio: 0 }]} locais={[]} insumoIdPreselecionado="insumo" open />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: texto } });
    await usuario.click(screen.getByRole("button", { name: "Registrar perda" }));
    await waitFor(() => expect(simulados.registrar).toHaveBeenCalledWith(expect.objectContaining({ quantidade })));
  }
);

it("exibe o valor calculado pelo custo médio e não oferece campo editável", () => {
  render(<PerdaDialog insumos={[{ id: "insumo", nome: "Insumo de teste", unidade: "KG", custoMedio: 72 }]} locais={[]} insumoIdPreselecionado="insumo" open />);
  fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "1,25" } });
  expect(screen.getByText("R$ 90,00")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: /Valor/ })).toBeNull();
});

it("mostra a quantidade fracionada completa na lista e na confirmação de estorno", () => {
  const fracionada = { ...perda, quantidade: 0.00000001 };
  render(<PerdasTable linhas={[fracionada]} responsavelNome="Allan" />);
  expect(screen.getAllByText("0,00000001 kg").length).toBeGreaterThan(0);
  render(<ExcluirPerdaDialog perda={fracionada} responsavelNome="Allan" aoFechar={vi.fn()} aoExcluir={vi.fn()} />);
  expect(screen.getAllByText("0,00000001 kg").length).toBeGreaterThan(1);
});

beforeEach(() => {
  // A lista inicia no mês até hoje; as fixtures de setembro exigem relógio explícito.
  // Somente Date é simulado: interações, promises e timeouts continuam reais.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-18T15:00:00Z"));
  simulados.registrar.mockResolvedValue({ perdaId: "perda", movimentacaoId: "movimento" });
  simulados.excluir.mockResolvedValue({ ok: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it("exige descrição para Outro e envia o motivo sem permitir informar outro responsável", async () => {
  const usuario = userEvent.setup();
  render(<PerdaDialog insumos={[{ id: "insumo", nome: "Queijo brie", unidade: "KG", custoMedio: 72 }]} locais={[]} insumoIdPreselecionado="insumo" responsavelNome="Allan" open />);
  expect(screen.getByText("Allan")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: /Responsável/ })).toBeNull();
  await usuario.click(screen.getByRole("combobox", { name: "Categoria da perda" }));
  await usuario.click(screen.getByRole("option", { name: "Outro" }));
  await usuario.click(screen.getByRole("button", { name: "Registrar perda" }));
  expect(simulados.registrar).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("Descreva o motivo");
  await usuario.type(screen.getByLabelText("Descreva o motivo"), "  Falha de refrigeração  ");
  fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "1,25" } });
  await usuario.click(screen.getByRole("button", { name: "Registrar perda" }));
  await waitFor(() => expect(simulados.registrar).toHaveBeenCalledWith(expect.objectContaining({ motivo: "OUTRO", motivoPersonalizado: "Falha de refrigeração", quantidade: 1.25 })));
  expect(simulados.registrar.mock.calls[0][0]).not.toHaveProperty("responsavelNome");
  expect(simulados.registrar.mock.calls[0][0]).not.toHaveProperty("responsavelId");
});

it("exclusão exige motivo, explicita devolução e envia somente id e justificativa", async () => {
  const usuario = userEvent.setup(), aoExcluir = vi.fn();
  render(<ExcluirPerdaDialog perda={perda} responsavelNome="Allan" aoFechar={vi.fn()} aoExcluir={aoExcluir} />);
  expect(screen.getByText("1,25 kg")).toBeTruthy();
  expect(screen.getByText("Allan")).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Excluir e devolver ao estoque" }));
  expect(simulados.excluir).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("motivo");
  await usuario.type(screen.getByLabelText("Motivo da exclusão"), "  Registro duplicado  ");
  await usuario.click(screen.getByRole("button", { name: "Excluir e devolver ao estoque" }));
  await waitFor(() => expect(simulados.excluir).toHaveBeenCalledWith({ perdaId: "perda", motivo: "Registro duplicado" }));
  expect(aoExcluir).toHaveBeenCalledOnce();
});

it("mantém exclusão aberta em erro do servidor e em falha de comunicação", async () => {
  const usuario = userEvent.setup(), aoExcluir = vi.fn();
  simulados.excluir.mockResolvedValueOnce({ erro: "Perda já excluída." }).mockRejectedValueOnce(new Error("rede"));
  render(<ExcluirPerdaDialog perda={perda} responsavelNome="Allan" aoFechar={vi.fn()} aoExcluir={aoExcluir} />);
  await usuario.type(screen.getByLabelText("Motivo da exclusão"), "Registro duplicado");
  await usuario.click(screen.getByRole("button", { name: "Excluir e devolver ao estoque" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Perda já excluída."));
  await usuario.click(screen.getByRole("button", { name: "Excluir e devolver ao estoque" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Atualize a página"));
  expect(aoExcluir).not.toHaveBeenCalled();
});

it("mostra motivo, unidade e autoria na lista sem oferecer histórico para usuário comum", () => {
  render(<PerdasTable linhas={[perda]} responsavelNome="Allan" />);
  expect(screen.getAllByText("Refrigeração interrompida").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Mariana Souza").length).toBeGreaterThan(0);
  expect(screen.getAllByText("1,25 kg").length).toBeGreaterThan(0);
  expect(screen.queryByRole("tab", { name: /Exclusões/ })).toBeNull();
});

it("admin consulta a exclusão e as duas autorias, mesmo sem perdas ativas, sem apagar histórico", async () => {
  const usuario = userEvent.setup();
  render(<PerdasTable linhas={[]} historico={[excluida]} responsavelNome="Allan" />);
  await usuario.click(screen.getByRole("tab", { name: /Exclusões \(1\)/ }));
  expect(screen.getByText("Registro duplicado")).toBeTruthy();
  expect(screen.getByText("Mariana Souza")).toBeTruthy();
  expect(screen.getByText("Allan")).toBeTruthy();
  expect(screen.getByText(/1,25 kg devolvidos ao estoque/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
});

it("cancelar a exclusão não chama a ação", async () => {
  const usuario = userEvent.setup(), aoFechar = vi.fn();
  render(<ExcluirPerdaDialog perda={perda} responsavelNome="Allan" aoFechar={aoFechar} aoExcluir={vi.fn()} />);
  await usuario.click(screen.getByRole("button", { name: "Voltar" }));
  expect(aoFechar).toHaveBeenCalledOnce();
  expect(simulados.excluir).not.toHaveBeenCalled();
});

it("não envia descrição de Outro ao escolher um motivo cadastrado", async () => {
  const usuario = userEvent.setup();
  render(<PerdaDialog insumos={[]} locais={[]} open />);
  await usuario.click(screen.getByRole("combobox", { name: "Categoria da perda" }));
  await usuario.click(screen.getByRole("option", { name: "Outro" }));
  await usuario.type(screen.getByLabelText("Descreva o motivo"), "Descrição que não será usada");
  screen.getByRole("combobox", { name: "Categoria da perda" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await usuario.click(await screen.findByRole("option", { name: "Quebra" }));
  expect(screen.queryByLabelText("Descreva o motivo")).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Registrar perda" }));
  await waitFor(() => expect(simulados.registrar).toHaveBeenCalledWith(expect.objectContaining({ motivo: "QUEBRA", motivoPersonalizado: null })));
});

it("bloqueia novo clique e fechamento durante a exclusão pendente", async () => {
  const usuario = userEvent.setup(), aoFechar = vi.fn(), aoExcluir = vi.fn();
  let concluir!: (resultado: { ok: true }) => void;
  simulados.excluir.mockReturnValueOnce(new Promise<{ ok: true }>((resolver) => { concluir = resolver; }));
  render(<ExcluirPerdaDialog perda={perda} responsavelNome="Allan" aoFechar={aoFechar} aoExcluir={aoExcluir} />);
  await usuario.type(screen.getByLabelText("Motivo da exclusão"), "Registro duplicado");
  const confirmar = screen.getByRole("button", { name: "Excluir e devolver ao estoque" });
  await usuario.click(confirmar);
  await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(true));
  await usuario.click(confirmar);
  await usuario.keyboard("{Escape}");
  expect(simulados.excluir).toHaveBeenCalledOnce();
  expect(aoFechar).not.toHaveBeenCalled();
  concluir({ ok: true });
  await waitFor(() => expect(aoExcluir).toHaveBeenCalledOnce());
});
