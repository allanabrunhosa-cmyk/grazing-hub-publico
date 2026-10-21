// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import { CategoriasDialog } from "@/app/(protegido)/insumos/categorias-dialog";
const acoes = vi.hoisted(() => ({ renomear: vi.fn(), excluir: vi.fn() }));
vi.mock("@/app/(protegido)/insumos/actions", () => ({ createCategoriaAction: vi.fn(), renameCategoriaAction: acoes.renomear, deleteCategoriaAction: acoes.excluir }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function montar(admin = true) { render(<ProvedorAcesso acesso={{ admin, permissoes: { insumos: ["visualizar"] }, excecoes: {} }}><CategoriasDialog categorias={[{ id: "cat", nome: "Queijos" }]} trigger={<Button>Categorias</Button>} /></ProvedorAcesso>); }
it("confirma explicitamente, não salva no blur e preserva erro/valor", async () => {
  acoes.renomear.mockRejectedValueOnce(new Error("rede")).mockResolvedValue(undefined);
  const usuario = userEvent.setup(); montar();
  await usuario.click(screen.getByRole("button", { name: "Categorias" }));
  const campo = screen.getByLabelText("Nome de Queijos") as HTMLInputElement;
  await usuario.clear(campo); await usuario.paste("Frios"); await usuario.tab();
  expect(acoes.renomear).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Confirmar Nome de Queijos" }));
  expect(await screen.findByRole("alert")).toBeDefined(); expect(campo.value).toBe("Frios");
  await usuario.click(campo); await usuario.keyboard("{Escape}"); expect(campo.value).toBe("Queijos");
  await usuario.clear(campo); await usuario.paste("Frios"); await usuario.keyboard("{Enter}");
  expect(await screen.findByLabelText("Nome de Frios")).toBeDefined();
  expect(acoes.renomear).toHaveBeenCalledTimes(2);
});
it("exclusão precisa confirmação e preserva categoria vinculada", async () => {
  acoes.excluir.mockResolvedValue({ error: "Categoria em uso." }); const usuario = userEvent.setup(); montar();
  await usuario.click(screen.getByRole("button", { name: "Categorias" }));
  const excluir = screen.getByRole("button", { name: "Excluir Queijos" });
  expect(excluir.getAttribute("data-acao")).toBe("excluir");
  await usuario.click(excluir); expect(acoes.excluir).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
  expect(acoes.excluir).toHaveBeenCalledWith("cat"); expect(screen.getByLabelText("Nome de Queijos")).toBeDefined();
});
it("leitor não edita, adiciona ou exclui", async () => {
  const usuario = userEvent.setup(); montar(false); await usuario.click(screen.getByRole("button", { name: "Categorias" }));
  expect(screen.getByLabelText("Nome de Queijos")).toHaveProperty("readOnly", true);
  expect(screen.getByRole("button", { name: "Excluir Queijos" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Adicionar categoria" })).toHaveProperty("disabled", true);
});
