// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ salvar: vi.fn(), corrigir: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(protegido)/inventario/producao/actions", () => ({ registrarProducaoPreparacaoAction: sim.salvar, corrigirProducaoPreparacaoAction: sim.corrigir }));
import { ProducaoPreparacoes } from "@/app/(protegido)/inventario/producao/producao-client";
const props = { editar: true, admin: true, locais: [{ id: "local", nome: "Cozinha fictícia" }], preparacoes: [{ id: "prep", nome: "Preparação fictícia", unidade: "KG", revisao: "2026-10-02T12:00:00.000Z", ingredientes: [{ id: "ing", nome: "Ingrediente fictício", unidade: "KG" }] }], registros: [] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
async function preencher() {
  const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Registrar produção" }));
  await u.click(screen.getByRole("combobox", { name: "Preparação" }));
  await u.click(await screen.findByRole("option", { name: "Preparação fictícia" }));
  await u.click(screen.getByRole("combobox", { name: "Local do estoque" }));
  await u.click(await screen.findByRole("option", { name: "Cozinha fictícia" }));
  fireEvent.change(screen.getByLabelText("Rendimento real (KG)"), { target: { value: "1.000001" } });
  fireEvent.change(screen.getByLabelText("Ingrediente fictício (KG)"), { target: { value: "2.000001" } });
  fireEvent.change(screen.getByLabelText("Referência ou observação do lote"), { target: { value: "Lote fictício" } });
  return u;
}
it("aponta quantidades reais sem salvar por blur; preserva dados e chave após erro", async () => {
  sim.salvar.mockResolvedValue({ erro: "Estoque disponível insuficiente" }); render(<ProducaoPreparacoes {...props} />);
  const u = await preencher(); fireEvent.blur(screen.getByLabelText("Ingrediente fictício (KG)")); expect(sim.salvar).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Confirmar produção" }));
  expect((await screen.findByRole("alert")).textContent).toContain("insuficiente");
  expect((screen.getByLabelText("Ingrediente fictício (KG)") as HTMLInputElement).value).toBe("2.000001");
  expect(sim.salvar.mock.calls[0][0]).toMatchObject({ quantidade: "1.000001", ingredientes: [{ insumoId: "ing", quantidade: "2.000001" }] });
  await u.click(screen.getByRole("button", { name: "Confirmar produção" })); expect(sim.salvar.mock.calls[1][0].chave).toBe(sim.salvar.mock.calls[0][0].chave);
});
it("preserva edição só de data e impede saída/repetição durante a transação", async () => {
  let concluir!: (r: { ok: true }) => void; sim.salvar.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
  render(<ProducaoPreparacoes {...props} />); const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Registrar produção" }));
  fireEvent.change(screen.getByLabelText("Data da produção"), { target: { value: "2026-09-01" } }); await u.keyboard("{Escape}");
  expect(await screen.findByRole("alertdialog")).toBeTruthy(); await u.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect((screen.getByLabelText("Data da produção") as HTMLInputElement).value).toBe("2026-09-01");
  await u.keyboard("{Escape}"); await u.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
  await preencher(); await u.click(screen.getByRole("button", { name: "Confirmar produção" })); await u.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeTruthy(); expect((screen.getByRole("button", { name: "Registrando…" }) as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  concluir({ ok: true }); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); expect(sim.salvar).toHaveBeenCalledTimes(1);
});
it("consulta sem permissão não oferece apontamento", () => { render(<ProducaoPreparacoes {...props} editar={false} admin={false} />); expect(screen.queryByRole("button", { name: "Registrar produção" })).toBeNull(); });
