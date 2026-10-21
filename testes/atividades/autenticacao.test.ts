import { beforeEach, describe, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ usuario: vi.fn(), verificar: vi.fn(), token: vi.fn(), sessao: vi.fn(), set: vi.fn(), delete: vi.fn(), registro: vi.fn(), tx: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: s.set, delete: s.delete }) }));
vi.mock("next/navigation", () => ({ redirect: (destino: string) => { throw new Error("REDIRECT:" + destino); } }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: s.usuario } }, bancoPrincipal: { $transaction: s.tx } }));
vi.mock("@/lib/auth", () => ({ verifyPassword: s.verificar, createSessionToken: s.token, sessionCookieOptions: { name: "sessao-sintetica" } }));
vi.mock("@/lib/session", () => ({ getSession: s.sessao }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: s.registro }));
import { loginAction, logoutAction } from "@/app/login/actions";
import { registrarAutenticacao } from "@/lib/atividades/autenticacao";
import { exigirPermissao } from "@/lib/permissoes/servidor";
const usuario = { id: "autor-confirmado", nome: "Pessoa sintética", email: "sintetico@example.invalid", senhaHash: "hash-nao-registrar", senhaDefinida: true, ativo: true, excluidoEm: null, admin: false, sessaoVersao: 1 };
function formulario(senha = "SenhaSintetica") { const form = new FormData(); form.set("email", usuario.email); form.set("senha", senha); return form; }
beforeEach(() => {
  vi.resetAllMocks();
  s.usuario.mockResolvedValue(usuario); s.verificar.mockResolvedValue(true); s.token.mockResolvedValue("token-nao-registrar");
  s.sessao.mockResolvedValue({ userId: usuario.id, nome: usuario.nome, admin: false, permissoes: {}, excecoes: {} });
  s.tx.mockImplementation(async (operacao) => operacao({ sintetico: true })); s.registro.mockResolvedValue(undefined);
});
describe("autenticação e recusa com resultado real", () => {
  it("login validado registra somente identidade confirmada antes de emitir cookie", async () => {
    await expect(loginAction({ erro: null }, formulario())).rejects.toThrow("REDIRECT:/");
    expect(s.registro).toHaveBeenCalledWith({ sintetico: true }, { userId: usuario.id, nome: usuario.nome }, expect.objectContaining({ acao: "LOGIN", resultado: "SUCESSO", origem: "INTERFACE" }));
    expect(s.registro.mock.invocationCallOrder[0]).toBeLessThan(s.set.mock.invocationCallOrder[0]);
    expect(JSON.stringify(s.registro.mock.calls)).not.toMatch(/hash-nao|token-nao|SenhaSintetica|example.invalid/);
  });
  it.each(["inexistente", "senha", "inativo", "excluido"])("recusa %s não atribui autoria ao e-mail informado", async (tipo) => {
    if (tipo === "inexistente") s.usuario.mockResolvedValue(null);
    if (tipo === "senha") s.verificar.mockResolvedValue(false);
    if (tipo === "inativo") s.usuario.mockResolvedValue({ ...usuario, ativo: false });
    if (tipo === "excluido") s.usuario.mockResolvedValue({ ...usuario, excluidoEm: new Date() });
    expect(await loginAction({ erro: null }, formulario())).toHaveProperty("erro", "E-mail ou senha inválidos.");
    expect(s.registro.mock.calls[0][1]).toEqual({ tipo: "SISTEMA", referencia: "Autenticação sem identidade confirmada" });
    expect(s.registro.mock.calls[0][2]).toMatchObject({ acao: "LOGIN_RECUSADO", resultado: "FALHA" });
    expect(s.set).not.toHaveBeenCalled();
  });
  it("falha do registro impede novo login, sem cookie e sem diagnóstico sensível", async () => {
    s.registro.mockRejectedValue(new Error("senha=segredo token=secreto"));
    const diagnostico = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await loginAction({ erro: null }, formulario())).toHaveProperty("erro", "Não foi possível iniciar a sessão. Tente novamente.");
      expect(s.set).not.toHaveBeenCalled(); expect(diagnostico.mock.calls).toEqual([["atividade_autenticacao_indisponivel", "LOGIN"]]);
    } finally { diagnostico.mockRestore(); }
  });
  it("logout é explícito, preserva saída quando registro falha e não supõe autor sem sessão", async () => {
    s.registro.mockRejectedValue(new Error("banco indisponível"));
    const diagnostico = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
      expect(s.registro.mock.calls[0][2]).toMatchObject({ acao: "LOGOUT_EXPLICITO" }); expect(s.delete).toHaveBeenCalled();
      s.sessao.mockResolvedValue(null); s.registro.mockClear();
      await expect(logoutAction()).rejects.toThrow("REDIRECT:/login"); expect(s.registro).not.toHaveBeenCalled();
    } finally { diagnostico.mockRestore(); }
  });
  it("recusa de escrita tem registro independente; leitura comum não produz evento", async () => {
    await expect(exigirPermissao("compras", "editar")).rejects.toThrow("REDIRECT:/sem-acesso");
    expect(s.registro.mock.calls[0][2]).toMatchObject({ acao: "AUTORIZACAO_NEGADA", recurso: "compras", resultado: "NEGADO" });
    expect(s.tx).toHaveBeenCalledTimes(1);
    s.registro.mockClear(); await expect(exigirPermissao("compras", "visualizar")).rejects.toThrow("REDIRECT:/sem-acesso");
    expect(s.registro).not.toHaveBeenCalled();
  });
  it("indisponibilidade da identidade durante logout não impede remover o cookie nem inventa autor", async () => {
    s.sessao.mockRejectedValue(new Error("credencial sensível do driver"));
    const diagnostico = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
      expect(s.delete).toHaveBeenCalled(); expect(s.registro).not.toHaveBeenCalled();
      expect(diagnostico.mock.calls).toEqual([["atividade_logout_identidade_indisponivel"]]);
    } finally { diagnostico.mockRestore(); }
  });
  it("falha de registro de recusa mantém bloqueio seguro", async () => {
    s.registro.mockRejectedValue(new Error("falha"));
    const diagnostico = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(exigirPermissao("compras", "editar")).rejects.toThrow("REDIRECT:/sem-acesso");
      await expect(registrarAutenticacao(null, "LOGIN_RECUSADO")).resolves.toBeUndefined();
    } finally { diagnostico.mockRestore(); }
  });
});
