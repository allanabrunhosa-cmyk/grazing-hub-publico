import { beforeEach, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
const sim = vi.hoisted(() => ({ sessao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import Pagina from "@/app/(laboratorio)/configuracoes/design/laboratorio/page";
import { LaboratorioDesign } from "@/components/design-system/laboratorio-design";

beforeEach(() => vi.resetAllMocks());
it("mantém o laboratório fora da moldura operacional, sem outra rota duplicada", () => {
  expect(existsSync("src/app/(laboratorio)/configuracoes/design/laboratorio/page.tsx")).toBe(true);
  expect(existsSync("src/app/(protegido)/configuracoes/design/laboratorio/page.tsx")).toBe(false);
});
it("exige sessão real antes de renderizar o laboratório", async () => {
  sim.sessao.mockResolvedValue(null);
  await expect(Pagina()).rejects.toThrow("REDIRECT:/login");
});
it("não libera laboratório ao usuário sem permissão", async () => {
  sim.sessao.mockResolvedValue({ admin: false, permissoes: {}, excecoes: {} });
  await expect(Pagina()).rejects.toThrow("REDIRECT:/sem-acesso");
});
it("mesmo permissão visual não substitui requisito administrativo", async () => {
  sim.sessao.mockResolvedValue({ admin: false, permissoes: { "configuracoes.design": ["visualizar"] }, excecoes: {} });
  await expect(Pagina()).rejects.toThrow("REDIRECT:/sem-acesso");
});
it("administrador recebe apenas o componente sintético, sem menu/cabeçalho", async () => {
  sim.sessao.mockResolvedValue({ admin: true, permissoes: {}, excecoes: {} });
  expect((await Pagina()).type).toBe(LaboratorioDesign);
});
