// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsuariosPermissoes } from "@/app/(protegido)/configuracoes/usuarios/usuarios-permissoes";
import { toast } from "sonner";
const m = vi.hoisted(() => ({ salvar: vi.fn(), usuario: vi.fn(), carregar: vi.fn(), excluirPerfil: vi.fn(), excluirUsuario: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/usuarios/actions", () => ({ salvarPerfilAcesso: m.salvar, salvarUsuarioAcesso: m.usuario, carregarAcessos: m.carregar, excluirPerfilAcesso: m.excluirPerfil, excluirUsuarioAcesso: m.excluirUsuario }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const dados = { usuarios: [], perfis: [], historico: [] };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("clicar Salvar perfil envia o formulário e mostra o perfil salvo", async () => {
  const usuario = userEvent.setup(); m.salvar.mockResolvedValue({ ok: true });
  m.carregar.mockResolvedValue({ ...dados, perfis: [{ id: "compras", nome: "Compras", descricao: "", sistema: null, permissoes: { compras: ["visualizar"] }, usuarios: 0, versao: "1" }] });
  render(<UsuariosPermissoes inicial={dados} />);
  await usuario.click(screen.getByRole("tab", { name: "Perfis de acesso" }));
  await usuario.click(screen.getByRole("button", { name: "Novo perfil" }));
  await usuario.click(screen.getByLabelText("Nome do perfil"));
  await usuario.paste("Compras");
  await usuario.click(screen.getByLabelText("Pedidos de compra: Visualizar"));
  await usuario.click(screen.getByRole("button", { name: "Salvar perfil" }));
  await waitFor(() => expect(m.salvar).toHaveBeenCalledOnce());
  expect(m.salvar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Compras", id: undefined, permissoes: { compras: ["visualizar"] } }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(within(screen.getByRole("tabpanel")).getByRole("heading", { name: "Compras" })).toBeTruthy();
});
it("salva edição do perfil com a versão correta e preserva o preenchimento para tentar novamente após erro", async () => {
  const usuario = userEvent.setup();
  const inicial = { ...dados, perfis: [{ id: "consulta", nome: "Consulta", descricao: "", sistema: null, permissoes: {}, usuarios: 0, versao: "versao-atual" }] };
  m.salvar.mockResolvedValueOnce({ erro: "Não foi possível salvar. Tente novamente." }).mockResolvedValueOnce({ ok: true });
  m.carregar.mockResolvedValue(inicial);
  render(<UsuariosPermissoes inicial={inicial} />);
  await usuario.click(screen.getByRole("tab", { name: "Perfis de acesso" }));
  await usuario.click(screen.getByRole("button", { name: "Ver permissões" }));
  await usuario.click(screen.getByLabelText("Descrição"));
  await usuario.paste("Equipe de consulta");
  await act(async () => { await usuario.click(screen.getByRole("button", { name: "Salvar perfil" })); });
  expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar. Tente novamente.");
  expect(screen.getByLabelText("Descrição")).toHaveProperty("value", "Equipe de consulta");
  await usuario.click(await screen.findByRole("button", { name: "Salvar perfil" }));
  expect(m.salvar).toHaveBeenLastCalledWith(expect.objectContaining({ id: "consulta", versao: "versao-atual", descricao: "Equipe de consulta" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("clicar Salvar usuário também envia o cadastro", async () => {
  const usuario = userEvent.setup();
  const inicial = { ...dados, perfis: [{ id: "consulta", nome: "Consulta", descricao: "", sistema: null, permissoes: {}, usuarios: 1, versao: "1" }], usuarios: [{ id: "pessoa", nome: "Pessoa", email: "pessoa@example.invalid", ativo: true, perfilAcessoId: "consulta", excecoes: {}, versao: "2" }] };
  m.usuario.mockResolvedValue({ ok: true }); m.carregar.mockResolvedValue(inicial);
  render(<UsuariosPermissoes inicial={inicial} />);
  await usuario.click(screen.getByRole("button", { name: "Gerenciar Pessoa" }));
  await usuario.click(screen.getByRole("button", { name: "Salvar usuário" }));
  expect(m.usuario).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "pessoa", versao: "2" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it.each(["perfil", "usuario"] as const)("mostra somente a confirmação de exclusão e retorna ao rascunho do %s", async origem => {
  const usuario = userEvent.setup();
  const inicial = { ...dados, perfis: [{ id: "perfil-ficticio", nome: "Perfil fictício", descricao: "Original", sistema: null, permissoes: {}, usuarios: 1, versao: "1" }], usuarios: [{ id: "pessoa-ficticia", nome: "Pessoa fictícia", email: "pessoa@example.invalid", ativo: true, perfilAcessoId: "perfil-ficticio", excecoes: {}, versao: "2" }] };
  render(<UsuariosPermissoes inicial={inicial} />);
  if (origem === "perfil") {
    await usuario.click(screen.getByRole("tab", { name: "Perfis de acesso" }));
    await usuario.click(screen.getByRole("button", { name: "Ver permissões" }));
  } else await usuario.click(screen.getByRole("button", { name: "Gerenciar Pessoa fictícia" }));
  const editor = screen.getByRole("dialog");
  const nomeCampo = origem === "perfil" ? "Descrição" : "Nome completo";
  fireEvent.change(within(editor).getByLabelText(nomeCampo), { target: { value: "Rascunho fictício preservado" } });
  await usuario.click(within(editor).getByRole("button", { name: origem === "perfil" ? "Excluir perfil" : "Excluir usuário" }));
  await screen.findByRole("dialog", { name: /^Excluir / });
  await waitFor(() => expect(editor.getAttribute("data-dialogo-suspenso")).toBe("true"));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(document.contains(editor)).toBe(true);
  await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(editor.hasAttribute("data-dialogo-suspenso")).toBe(false));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(editor).getByLabelText(nomeCampo)).toHaveProperty("value", "Rascunho fictício preservado");
  expect(m.excluirPerfil).not.toHaveBeenCalled();
  expect(m.excluirUsuario).not.toHaveBeenCalled();
  expect(m.salvar).not.toHaveBeenCalled();
  expect(m.usuario).not.toHaveBeenCalled();
});

it("novo usuário recebe convite sem campo de senha do administrador",async()=>{render(<UsuariosPermissoes inicial={dados}/>);await userEvent.click(screen.getByRole("button",{name:"Novo usuário"}));expect(screen.queryByText("Senha inicial")).toBeNull();expect(screen.getByText(/O usuário cria a própria senha/)).toBeTruthy();});
