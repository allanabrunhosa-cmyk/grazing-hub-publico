// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsuariosPermissoes } from "@/app/(protegido)/configuracoes/usuarios/usuarios-permissoes";
import { toast } from "sonner";
import type { DadosAcessos } from "@/app/(protegido)/configuracoes/usuarios/types";
import type { Acao } from "@/lib/permissoes/catalogo";

const sim = vi.hoisted(() => ({ excluir: vi.fn(), carregar: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/usuarios/actions", () => ({
  excluirUsuarioAcesso: sim.excluir,
  carregarAcessos: sim.carregar,
  salvarPerfilAcesso: vi.fn(),
  salvarUsuarioAcesso: vi.fn(),
  excluirPerfilAcesso: vi.fn(),
  alterarStatusUsuarioAcesso: vi.fn(),
  enviarLinkSenhaUsuarioAcesso: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const dados: DadosAcessos = {
  perfis: [], historico: [],
  usuarios: [{ id: "pessoa-ficticia", nome: "Pessoa fictícia", email: "pessoa@example.invalid", ativo: true, perfilAcessoId: null, excecoes: {}, versao: "revisao-1" }],
};
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each([true, false])("oferece exclusão direta de usuário ativo=%s com confirmação e cancelamento sem gravar", async ativo => {
  render(<UsuariosPermissoes inicial={{ ...dados, usuarios: [{ ...dados.usuarios[0], ativo }] }} />);
  const acoes = screen.getByRole("group", { name: "Ações de Pessoa fictícia" });
  const excluir = within(acoes).getByRole("button", { name: "Excluir usuário Pessoa fictícia" });
  expect(excluir.getAttribute("data-acao")).toBe("excluir");
  expect(excluir.textContent).toBe("");
  await userEvent.click(excluir);
  const dialogo = screen.getByRole("dialog", { name: "Excluir Pessoa fictícia?" });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(dialogo).getByText(/O histórico das operações realizadas por esta pessoa será preservado/)).toBeTruthy();
  expect(sim.excluir).not.toHaveBeenCalled();
  await userEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(sim.excluir).not.toHaveBeenCalled();
  expect(sim.carregar).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Excluir usuário Pessoa fictícia" })).toBeTruthy();
});

it.each<{ capacidades: Acao[] }>([
  { capacidades: ["visualizar"] },
  { capacidades: ["visualizar", "editar"] },
])("oculta exclusão quando as capacidades são $capacidades", ({ capacidades }) => {
  render(<UsuariosPermissoes inicial={dados} capacidades={capacidades} />);
  expect(screen.queryByRole("button", { name: /Excluir usuário/ })).toBeNull();
});

it("envia id e versão corretos, bloqueia duplicação pendente e recarrega após sucesso sem perder busca", async () => {
  let concluir!: (resultado: { ok: true }) => void;
  sim.excluir.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
  sim.carregar.mockResolvedValue({ ...dados, usuarios: [] });
  render(<UsuariosPermissoes inicial={dados} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar usuários ou perfis" }), { target: { value: "Pessoa" } });
  await userEvent.click(screen.getByRole("button", { name: "Excluir usuário Pessoa fictícia" }));
  const confirmar = screen.getByRole("button", { name: "Confirmar exclusão" });
  await userEvent.click(confirmar);
  expect(sim.excluir).toHaveBeenCalledExactlyOnceWith("pessoa-ficticia", "revisao-1");
  expect(confirmar).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Cancelar" })).toHaveProperty("disabled", true);
  fireEvent.click(confirmar);
  expect(sim.excluir).toHaveBeenCalledOnce();
  expect(sim.carregar).not.toHaveBeenCalled();
  await act(async () => concluir({ ok: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(sim.carregar).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Excluir usuário Pessoa fictícia" })).toBeNull();
  expect(screen.getByRole("textbox", { name: "Buscar usuários ou perfis" })).toHaveProperty("value", "Pessoa");
});

it("preserva usuário e confirmação quando o servidor rejeita a exclusão", async () => {
  sim.excluir.mockResolvedValue({ erro: "Mantenha pelo menos um administrador ativo no sistema." });
  render(<UsuariosPermissoes inicial={dados} />);
  await userEvent.click(screen.getByRole("button", { name: "Excluir usuário Pessoa fictícia" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Mantenha pelo menos um administrador ativo no sistema."));
  expect(screen.getByRole("dialog", { name: "Excluir Pessoa fictícia?" })).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toHaveProperty("disabled", false));
  expect(sim.carregar).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("button", { name: "Excluir usuário Pessoa fictícia" })).toBeTruthy();
});
