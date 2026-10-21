import { beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ usuario: vi.fn(), verificar: vi.fn(), token: vi.fn(), cookie: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: s.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: (destino: string) => { throw new Error(`redirect:${destino}`); } }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: s.usuario } } }));
vi.mock("@/lib/atividades/autenticacao", () => ({ registrarAutenticacao: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ verifyPassword: s.verificar, createSessionToken: s.token, sessionCookieOptions: { name: "sessao" } }));
import { loginAction } from "@/app/login/actions";
const formulario = () => { const f = new FormData(); f.set("email", "pessoa@example.invalid"); f.set("senha", "Abcdefg!"); return f; };
beforeEach(() => { s.verificar.mockResolvedValue(true); s.token.mockResolvedValue("token-ficticio"); });
it("convite pendente não inicia sessão, mesmo com uma senha que coincida com o hash", async () => {
  s.usuario.mockResolvedValue({ ativo: true, excluidoEm: null, senhaDefinida: false, senhaHash: "hash-ficticio" });
  expect(await loginAction({ erro: null }, formulario())).toEqual({ erro: "E-mail ou senha inválidos." });
  expect(s.verificar).not.toHaveBeenCalled(); expect(s.cookie).not.toHaveBeenCalled();
});
it("senha definida inicia a sessão usada pelo HUB e pelos hosts dedicados", async () => {
  s.usuario.mockResolvedValue({ id: "pessoa", email: "pessoa@example.invalid", nome: "Pessoa", ativo: true, excluidoEm: null, senhaDefinida: true, senhaHash: "hash-ficticio", sessaoVersao: 1, admin: false });
  await expect(loginAction({ erro: null }, formulario())).rejects.toThrow("redirect:/");
  expect(s.cookie).toHaveBeenCalledWith("sessao", "token-ficticio", expect.any(Object));
  expect(s.token).toHaveBeenCalledWith(expect.objectContaining({ userId: "pessoa", versao: 1 }));
});
