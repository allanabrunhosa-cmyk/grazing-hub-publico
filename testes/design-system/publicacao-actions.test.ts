import { beforeEach, expect, it, vi } from "vitest";

const simulados = vi.hoisted(() => ({
  sessao: vi.fn(), salvar: vi.fn(), publicar: vi.fn(), restaurar: vi.fn(), tema: vi.fn(), revalidar: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: simulados.sessao }));
vi.mock("@/lib/design-system/servico", () => ({
  ErroDesign: class ErroDesign extends Error {},
  salvarRascunhoDesign: simulados.salvar,
  publicarRascunhoDesign: simulados.publicar,
  restaurarVersaoDesign: simulados.restaurar,
  obterTemaPublicado: simulados.tema,
}));
vi.mock("next/cache", () => ({ revalidatePath: simulados.revalidar }));
vi.mock("next/navigation", () => ({ redirect: (destino: string) => { throw new Error(`REDIRECT:${destino}`); } }));

import { publicarRascunhoDesignAction, restaurarVersaoDesignAction, salvarRascunhoDesignAction } from "@/app/(protegido)/configuracoes/design/actions";
import { GET } from "@/app/api/design/revisao/route";

beforeEach(() => {
  vi.resetAllMocks();
  simulados.sessao.mockResolvedValue({ userId: "admin", admin: true });
  simulados.salvar.mockResolvedValue({ revisao: 1, valores: { "botao.raio": "1rem" }, versaoBase: 0, autor: "Admin", atualizadoEm: "2026-09-21T00:00:00.000Z" });
  simulados.publicar.mockResolvedValue({ repetida: false, versao: { numero: 1, valores: {}, id: "versao-1" } });
  simulados.restaurar.mockResolvedValue({ repetida: false, versao: { numero: 2, valores: {}, id: "versao-2" } });
  simulados.tema.mockResolvedValue({ revisao: 3, valores: {} });
});

it("rejeita chamadas diretas de não administradores sem tocar no serviço", async () => {
  simulados.sessao.mockResolvedValue({ userId: "leitor", admin: false, permissoes: {}, excecoes: {} });
  await expect(salvarRascunhoDesignAction({ valores: {}, revisao: 0, versaoBase: 0 })).rejects.toThrow("REDIRECT:/sem-acesso");
  await expect(publicarRascunhoDesignAction({ revisao: 1, motivo: "teste válido", chaveIdempotencia: "12345678901234567890" })).rejects.toThrow("REDIRECT:/sem-acesso");
  await expect(restaurarVersaoDesignAction({ versaoId: "versao-1", versaoBase: 1, motivo: "teste válido", chaveIdempotencia: "12345678901234567890" })).rejects.toThrow("REDIRECT:/sem-acesso");
  expect(simulados.salvar).not.toHaveBeenCalled();
  expect(simulados.publicar).not.toHaveBeenCalled();
  expect(simulados.restaurar).not.toHaveBeenCalled();
});

it("atribui a autoria da sessão e revalida a Central ao salvar, publicar e restaurar", async () => {
  await salvarRascunhoDesignAction({ valores: { "botao.raio": "1rem" }, revisao: 0, versaoBase: 0 });
  await publicarRascunhoDesignAction({ revisao: 1, motivo: "Ajuste aprovado", chaveIdempotencia: "12345678901234567890" });
  await restaurarVersaoDesignAction({ versaoId: "versao-1", versaoBase: 1, motivo: "Retorno aprovado", chaveIdempotencia: "abcdefghijklmnopqrst" });
  expect(simulados.salvar).toHaveBeenCalledWith({ valores: { "botao.raio": "1rem" }, revisao: 0, versaoBase: 0, autorId: "admin" });
  expect(simulados.publicar).toHaveBeenCalledWith({ revisao: 1, motivo: "Ajuste aprovado", chaveIdempotencia: "12345678901234567890", autorId: "admin" });
  expect(simulados.restaurar).toHaveBeenCalledWith({ versaoId: "versao-1", versaoBase: 1, motivo: "Retorno aprovado", chaveIdempotencia: "abcdefghijklmnopqrst", autorId: "admin" });
  expect(simulados.revalidar).toHaveBeenCalledWith("/", "layout");
  expect(simulados.revalidar).toHaveBeenCalledWith("/configuracoes/design");
});

it("expõe apenas a revisão publicada para uma sessão autenticada", async () => {
  const resposta = await GET();
  expect(resposta.status).toBe(200);
  expect(resposta.headers.get("Cache-Control")).toBe("no-store");
  await expect(resposta.json()).resolves.toEqual({ revisao: 3 });
  expect(simulados.tema).toHaveBeenCalledOnce();
  simulados.sessao.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
});

it("redireciona usuário sem sessão antes de salvar", async () => {
  simulados.sessao.mockResolvedValue(null);
  await expect(salvarRascunhoDesignAction({ valores: {}, revisao: 0, versaoBase: 0 })).rejects.toThrow("REDIRECT:/login");
  expect(simulados.salvar).not.toHaveBeenCalled();
});
