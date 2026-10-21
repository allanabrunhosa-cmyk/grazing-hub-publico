import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), permissao: vi.fn(), importar: vi.fn(), revalidar: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: mocks.permissao }));
vi.mock("@/lib/nfse/servico", () => ({ importarNfseMunicipal: mocks.importar }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidar }));
import { POST } from "@/app/api/nfse/importar-municipal/route";
const entrada = { municipioCodigo: "3550308", cnpjPrestador: "12345678000190", numero: "42", dataEmissao: "2026-09-01", codigoVerificacao: "ABCD1234" };
function pedido() { return new Request("http://localhost/api/nfse/importar-municipal", { method: "POST", body: JSON.stringify({ ...entrada, autor: "Autor forjado" }) }); }
beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({ nome: "Autor da sessão" }); mocks.permissao.mockResolvedValue(true); mocks.importar.mockResolvedValue({ nova: true }); });
it("exige sessão e permissão de adicionar antes da consulta", async () => {
  mocks.sessao.mockResolvedValue(null);
  expect((await POST(pedido())).status).toBe(401);
  mocks.sessao.mockResolvedValue({ nome: "Usuário" }); mocks.permissao.mockResolvedValue(false);
  expect((await POST(pedido())).status).toBe(403);
  expect(mocks.importar).not.toHaveBeenCalled();
  expect(mocks.permissao).toHaveBeenCalledWith("financeiro.nfse", "adicionar");
});
it("usa autoria da sessão e atualiza a listagem após importação", async () => {
  const resposta = await POST(pedido());
  expect(resposta.status).toBe(200);
  expect(mocks.importar).toHaveBeenCalledWith(entrada, "Autor da sessão");
  expect(mocks.revalidar).toHaveBeenCalledWith("/financeiro/manifesto-nfs");
});
it("devolve a falha sem revalidar e distingue a nota existente", async () => {
  mocks.importar.mockResolvedValue({ erro: "Código de verificação divergente" });
  expect((await POST(pedido())).status).toBe(400);
  expect(mocks.revalidar).not.toHaveBeenCalled();
  mocks.importar.mockResolvedValue({ nova: false });
  expect((await (await POST(pedido())).json()).mensagem).toContain("preservados");
});
