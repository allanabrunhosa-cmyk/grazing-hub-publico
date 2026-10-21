import { beforeEach, expect, it, vi } from "vitest";
import VisaoGeralFiscal from "@/app/(protegido)/financeiro/fiscal/page";

const sim = vi.hoisted(() => ({ sessao: vi.fn(), banco: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("next/navigation", () => ({ redirect: (rota: string) => { throw new Error(`REDIRECT:${rota}`); } }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: () => { sim.banco(); throw new Error("BANCO_NAO_DEVE_SER_ACESSADO"); } }) }));
vi.mock("@/app/(protegido)/financeiro/fiscal/painel-fiscal", () => ({ PainelFiscal: () => null }));
beforeEach(() => vi.resetAllMocks());

it.each([
  ["sem sessão", null, "/login"],
  ["sem concessões", { admin: false, permissoes: {}, excecoes: {} }, "/sem-acesso"],
  ["editor do cadastro fiscal histórico", { admin: false, permissoes: { "vendas.fiscal": ["visualizar", "editar", "excluir"] }, excecoes: {} }, "/sem-acesso"],
  ["leitor financeiro", { admin: false, permissoes: { "financeiro.dre": ["visualizar"] }, excecoes: {} }, "/sem-acesso"],
  ["exceção retira o painel", { admin: false, permissoes: { "financeiro.fiscal.painel": ["visualizar"] }, excecoes: { "financeiro.fiscal.painel": { visualizar: false } } }, "/sem-acesso"],
] as const)("painel recusa %s pela guarda central antes de qualquer leitura fiscal", async (_, sessao, destino) => {
  sim.sessao.mockResolvedValueOnce(sessao);
  await expect(VisaoGeralFiscal({ searchParams: Promise.resolve({}) })).rejects.toThrow(`REDIRECT:${destino}`);
  expect(sim.sessao).toHaveBeenCalled();
  expect(sim.banco).not.toHaveBeenCalled();
});
