// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { InsumoActionsCell } from "@/app/(protegido)/insumos/insumo-actions-cell";
import { insumoStatus } from "../cadastros/dados";

const acoes = vi.hoisted(() => ({ consultar: vi.fn(), excluir: vi.fn() }));
vi.mock("@/app/(protegido)/insumos/actions", () => ({ consultarExclusaoInsumoAction: acoes.consultar, deleteInsumoAction: acoes.excluir }));
const livres = { preparacoes: [], complementos: [], produtos: [], outrosVinculos: false, revisao: "previa-ficticia" };
beforeEach(() => {
  acoes.consultar.mockResolvedValue({ error: null, vinculos: livres });
  acoes.excluir.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function montar(admin = true) {
  render(<ProvedorAcesso acesso={{ admin, permissoes: {}, excecoes: {} }}><InsumoActionsCell insumo={insumoStatus} /></ProvedorAcesso>);
}
async function abrir(aguardarConsulta = true) {
  const usuario = userEvent.setup(); montar();
  await usuario.click(screen.getByRole("button", { name: "Excluir item" }));
  await waitFor(() => expect(acoes.consultar).toHaveBeenCalledWith("farinha"));
  if (aguardarConsulta) await waitFor(() => expect(screen.getByRole("button", { name: "Voltar" })).toHaveProperty("disabled", false));
  return usuario;
}

it("confirmação mostra Voltar com a cor anterior e Excluir com fundo vermelho fixo", async () => {
  const usuario = await abrir();
  const voltar = screen.getByRole("button", { name: "Voltar" });
  const excluir = screen.getByRole("button", { name: "Confirmar exclusão" });
  expect(voltar.className).toContain("text-foreground");
  expect(excluir.textContent).toBe("Excluir");
  expect(excluir.className).toContain("bg-destructive"); expect(excluir.className).toContain("text-white");
  expect(excluir.getAttribute("data-acao")).toBeNull();
  expect(acoes.excluir).not.toHaveBeenCalled();
  await usuario.click(voltar);
  expect(acoes.excluir).not.toHaveBeenCalled();
});

it("exclui item livre apenas depois da confirmação explícita", async () => {
  const usuario = await abrir();
  await usuario.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
  expect(acoes.excluir).toHaveBeenCalledExactlyOnceWith("farinha", "previa-ficticia");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it.each(["preparacoes", "complementos", "produtos"])("lista %s e informa remoção das composições após confirmação", async tipo => {
  acoes.consultar.mockResolvedValue({ error: null, vinculos: { ...livres, [tipo]: [{ id: "uso", nome: "Cadastro fictício vinculado" }] } });
  const usuario = await abrir();
  expect(await screen.findByText("Cadastro fictício vinculado")).toBeTruthy();
  expect(screen.getByText(/será removido das fichas técnicas e composições indicadas/)).toBeTruthy();
  const excluir = screen.getByRole("button", { name: "Confirmar exclusão" });
  expect(excluir).toHaveProperty("disabled", false);
  await usuario.click(excluir);
  expect(acoes.excluir).toHaveBeenCalledExactlyOnceWith("farinha", "previa-ficticia");
});

it("reconsulta os vínculos ao retornar e libera após desvinculação", async () => {
  acoes.consultar.mockResolvedValueOnce({ error: null, vinculos: { ...livres, produtos: [{ id: "uso", nome: "Produto fictício" }] } });
  const usuario = await abrir();
  expect(await screen.findByText("Produto fictício")).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Voltar" }));
  await usuario.click(screen.getByRole("button", { name: "Excluir item" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toHaveProperty("disabled", false));
  expect(acoes.consultar).toHaveBeenCalledTimes(2);
});

it("falha ou consulta pendente mantém exclusão bloqueada", async () => {
  let concluir!: (valor: { error: string }) => void;
  acoes.consultar.mockReturnValue(new Promise(resolve => { concluir = resolve; }));
  await abrir(false);
  expect(screen.getByRole("status").textContent).toMatch(/Verificando/);
  expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toHaveProperty("disabled", true);
  concluir({ error: "Falha simulada na consulta" });
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Falha simulada na consulta");
  expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toHaveProperty("disabled", true);
});

it("mantém item e mostra novos vínculos detectados pelo servidor na confirmação", async () => {
  acoes.excluir.mockResolvedValueOnce({ error: "Composições mudaram", vinculos: { ...livres, revisao: "nova-previa", preparacoes: [{ id: "nova", nome: "Preparação recém-vinculada" }] } });
  const usuario = await abrir();
  await usuario.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
  expect(await screen.findByText("Preparação recém-vinculada")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toHaveProperty("disabled", false));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(acoes.excluir).toHaveBeenCalledTimes(1);
  await usuario.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
  expect(acoes.excluir).toHaveBeenLastCalledWith("farinha", "nova-previa");
});

it("informa preservação dos históricos e oculta ação sem permissão", async () => {
  acoes.consultar.mockResolvedValue({ error: null, vinculos: { ...livres, outrosVinculos: true } });
  await abrir();
  expect(await screen.findByText(/Históricos de vendas, compras, perdas, estoque e pedidos existentes serão preservados/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toHaveProperty("disabled", false);
  cleanup(); montar(false);
  expect(screen.queryByRole("button", { name: "Excluir item" })).toBeNull();
});
