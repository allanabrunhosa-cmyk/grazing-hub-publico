import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/insumos/porcoes-servidor", () => ({ consultarPorcoes: sim.consultar, RECURSOS_LEITURA: ["suprimentos.porcoes", "insumos", "vendas.produtos"], ErroPorcao: class extends Error {} }));
import { GET } from "@/app/api/insumos/[id]/porcoes/route";
import { ErroPorcao } from "@/lib/insumos/porcoes-servidor";
const consultar = (id = "embalagem-ficticia") => GET(new Request("http://localhost/api/insumos/" + id + "/porcoes"), { params: Promise.resolve({ id }) });
beforeEach(() => { vi.resetAllMocks(); sim.sessao.mockResolvedValue({ admin: false, permissoes: {}, excecoes: {} }); });
it("bloqueia sessão ausente e consulta sem permissão antes do banco", async () => {
  sim.sessao.mockResolvedValueOnce(null);
  expect((await consultar()).status).toBe(401);
  expect((await consultar()).status).toBe(403);
  expect(sim.consultar).not.toHaveBeenCalled();
});
it.each(["suprimentos.porcoes", "insumos", "vendas.produtos"])("permite leitura por %s, sem conceder cadastro", async recurso => {
  const sessao = { admin: false, permissoes: { [recurso]: ["visualizar"] }, excecoes: {} };
  sim.sessao.mockResolvedValue(sessao);
  sim.consultar.mockResolvedValue({ porcoes: [], podeCadastrar: false });
  const resposta = await consultar();
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toEqual({ porcoes: [], podeCadastrar: false });
  expect(resposta.headers.get("Cache-Control")).toBe("private, no-store");
  expect(sim.consultar).toHaveBeenCalledWith("embalagem-ficticia", sessao);
});
it("edição isolada não permite consulta e exceção de negação é respeitada", async () => {
  sim.sessao.mockResolvedValue({ admin: false, permissoes: { insumos: ["editar"] }, excecoes: {} });
  expect((await consultar()).status).toBe(403);
  sim.sessao.mockResolvedValue({ admin: false, permissoes: { insumos: ["visualizar"] }, excecoes: { insumos: { visualizar: false } } });
  expect((await consultar()).status).toBe(403);
  expect(sim.consultar).not.toHaveBeenCalled();
});
it("rejeita identificador inválido antes da consulta", async () => {
  sim.sessao.mockResolvedValue({ admin: true });
  expect((await consultar("../teste")).status).toBe(400);
  expect(sim.consultar).not.toHaveBeenCalled();
});
it("falha inesperada não expõe detalhes internos nem vira lista vazia", async () => {
  sim.sessao.mockResolvedValue({ admin: true });
  sim.consultar.mockRejectedValue(new Error("informação interna fictícia"));
  const resposta = await consultar();
  expect(resposta.status).toBe(503);
  expect(await resposta.json()).toEqual({ erro: "Não foi possível consultar as porções. Tente novamente." });
});
it("revalidação da sessão no serviço permanece obrigatória", async () => {
  sim.sessao.mockResolvedValue({ admin: true });
  sim.consultar.mockRejectedValue(new ErroPorcao("Sua sessão expirou. Entre novamente."));
  expect(await (await consultar()).json()).toEqual({ erro: "Sua sessão expirou. Entre novamente." });
});
