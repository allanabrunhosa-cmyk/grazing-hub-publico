// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import { LocaisDialog } from "@/app/(protegido)/inventario/locais-dialog";
import { CategoriasPerdaDialog } from "@/app/(protegido)/inventario/perdas/categorias-dialog";
const acoes = vi.hoisted(() => ({ renomear: vi.fn(), excluir: vi.fn(), status: vi.fn() }));
vi.mock("@/app/(protegido)/inventario/actions", () => ({ createLocalAction: vi.fn(), renameLocalAction: acoes.renomear, deleteLocalAction: acoes.excluir }));
vi.mock("@/app/(protegido)/inventario/perdas/categorias-actions", () => ({ adicionarCategoriaPerdaAction: vi.fn(), alterarCategoriaPerdaAction: acoes.status, removerCategoriaPerdaAction: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("local não salva no blur, cancela e mantém texto em falha", async () => {
  const usuario = userEvent.setup();
  acoes.renomear.mockRejectedValueOnce(new Error("rede")).mockResolvedValue(undefined);
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><LocaisDialog locais={[{ id: "local", nome: "Cozinha" }]} trigger={<Button>Locais</Button>} /></ProvedorAcesso>);
  await usuario.click(screen.getByRole("button", { name: "Locais" }));
  const campo = screen.getByLabelText("Nome de Cozinha") as HTMLInputElement;
  await usuario.clear(campo); await usuario.paste("Depósito"); await usuario.tab();
  expect(acoes.renomear).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Cancelar Nome de Cozinha" }));
  expect(campo.value).toBe("Cozinha");
  await usuario.clear(campo); await usuario.paste("Depósito"); await usuario.keyboard("{Enter}");
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Não foi possível renomear o local. Confira o nome e seu acesso.");
  expect(campo.value).toBe("Depósito");
  await usuario.keyboard("{Enter}");
  await waitFor(() => expect(acoes.renomear).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("Nome de Depósito")).toBeDefined();
});

it("categoria mantém status confirmado em erro e respeita acesso", async () => {
  const usuario = userEvent.setup();
  acoes.status.mockResolvedValueOnce({ erro: "Falha controlada" }).mockResolvedValue({ ok: true });
  render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><CategoriasPerdaDialog categorias={[{ id: "categoria", nome: "Quebra", ativo: true, codigoLegado: null, usada: true }]} /></ProvedorAcesso>);
  await usuario.click(screen.getByRole("button", { name: "Gerenciar categorias" }));
  const status = screen.getByRole("switch", { name: "Status de Quebra" });
  await usuario.click(status);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Falha controlada");
  expect(status.getAttribute("aria-checked")).toBe("true");
  await usuario.click(status);
  await waitFor(() => expect(status.getAttribute("aria-checked")).toBe("false"));
  expect(screen.queryByRole("button", { name: "Remover Quebra" })).toBeNull();
});

it("leitor não edita nem remove locais", async () => {
  const usuario = userEvent.setup();
  render(<ProvedorAcesso acesso={{ admin: false, permissoes: { inventario: ["visualizar"] }, excecoes: {} }}><LocaisDialog locais={[{ id: "local", nome: "Cozinha" }]} trigger={<Button>Locais</Button>} /></ProvedorAcesso>);
  await usuario.click(screen.getByRole("button", { name: "Locais" }));
  expect((screen.getByLabelText("Nome de Cozinha") as HTMLInputElement).readOnly).toBe(true);
  expect((screen.getByRole("button", { name: "Excluir Cozinha" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Adicionar local" }) as HTMLButtonElement).disabled).toBe(true);
});
