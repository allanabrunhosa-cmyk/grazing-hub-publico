import { beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ atualizar: vi.fn(), token: vi.fn(), cookie: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: s.cookie }) }));
vi.mock("@/lib/session", () => ({ getSession: async () => ({ userId: "pessoa", versao: 0, nome: "Pessoa", email: "pessoa@example.invalid", admin: false }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: async () => ({ id: "pessoa", senhaHash: "hash-anterior" }), updateMany: s.atualizar } } }));
vi.mock("@/lib/auth", () => ({ hashPassword: async () => "hash-novo", verifyPassword: async () => true, createSessionToken: s.token, sessionCookieOptions: { name: "sessao" } }));
import { alterarSenhaAction } from "@/app/(protegido)/perfil/actions";
const dados = () => { const f = new FormData(); f.set("senhaAtual", "SenhaAtual123"); f.set("novaSenha", "SenhaNova123!"); f.set("confirmarNovaSenha", "SenhaNova123!"); return f; };
beforeEach(() => s.token.mockResolvedValue("token-ficticio"));
it("uma recuperação concorrente impede sessão antiga de sobrescrever a nova senha", async () => {
  s.atualizar.mockResolvedValue({ count: 0 });
  expect(await alterarSenhaAction(null, dados())).toHaveProperty("erro");
  expect(s.atualizar).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sessaoVersao: 0, senhaHash: "hash-anterior", ativo: true, excluidoEm: null }) }));
  expect(s.token).not.toHaveBeenCalled(); expect(s.cookie).not.toHaveBeenCalled();
});
it("alteração normal mantém apenas a sessão atual na versão incrementada", async () => {
  s.atualizar.mockResolvedValue({ count: 1 }); expect(await alterarSenhaAction(null, dados())).toEqual({ ok: true });
  expect(s.token).toHaveBeenCalledWith(expect.objectContaining({ versao: 1 })); expect(s.cookie).toHaveBeenCalled();
});
