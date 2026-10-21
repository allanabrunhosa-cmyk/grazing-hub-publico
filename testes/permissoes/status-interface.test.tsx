// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsuariosPermissoes } from "@/app/(protegido)/configuracoes/usuarios/usuarios-permissoes";
const sim = vi.hoisted(() => ({ status: vi.fn(), carregar: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/usuarios/actions", () => ({ alterarStatusUsuarioAcesso: sim.status, carregarAcessos: sim.carregar, salvarPerfilAcesso: vi.fn(), salvarUsuarioAcesso: vi.fn(), excluirPerfilAcesso: vi.fn(), excluirUsuarioAcesso: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const dados = { perfis: [], historico: [], usuarios: [{ id: "u", nome: "Pessoa fictícia", email: "teste@example.invalid", ativo: true, perfilAcessoId: null, excecoes: {}, versao: "revisao-1" }] };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("exige confirmação, cancela sem gravar, preserva em erro e atualiza sem perder a busca", async () => {
  render(<UsuariosPermissoes inicial={dados} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar usuários ou perfis" }), { target: { value: "Pessoa" } });
  fireEvent.click(screen.getByRole("switch"));
  expect(screen.getByText(/As sessões deste usuário serão encerradas/)).toBeTruthy();
  expect(sim.status).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("switch"));
  sim.status.mockResolvedValueOnce({ erro: "Último administrador" });
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar situação" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Último administrador");
  sim.status.mockResolvedValueOnce({ ok: true });
  sim.carregar.mockResolvedValue({ ...dados, usuarios: [{ ...dados.usuarios[0], ativo: false, versao: "revisao-2" }] });
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar situação" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("textbox", { name: "Buscar usuários ou perfis" })).toHaveProperty("value", "Pessoa");
  expect(sim.status).toHaveBeenLastCalledWith("u", "revisao-1", false);
});
it("consulta explica bloqueio e abas operam por teclado", async () => {
  render(<UsuariosPermissoes inicial={dados} capacidades={["visualizar"]} />);
  expect(screen.getByRole("switch")).toHaveProperty("disabled", true);
  expect(screen.getByText("Seu perfil permite somente consultar usuários.")).toBeTruthy();
  screen.getByRole("tab", { name: "Usuários" }).focus();
  await userEvent.keyboard("{ArrowRight}{Enter}");
  expect(screen.getByRole("tab", { name: "Perfis de acesso" }).getAttribute("aria-selected")).toBe("true");
});
