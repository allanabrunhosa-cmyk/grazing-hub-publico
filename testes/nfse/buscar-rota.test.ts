import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), permissao: vi.fn(), sincronizar: vi.fn(), revalidar: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: mocks.permissao }));
vi.mock("@/lib/nfse/servico", () => ({ sincronizarNfse: mocks.sincronizar }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidar }));
import { POST } from "@/app/api/nfse/buscar/route";
beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({ nome: "Teste" }); mocks.permissao.mockResolvedValue(true); });
describe("busca NFS-e por API", () => {
  it("exige autenticação e permissão antes da consulta fiscal", async () => {
    mocks.sessao.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
    mocks.sessao.mockResolvedValue({ nome: "Teste" }); mocks.permissao.mockResolvedValue(false);
    expect((await POST()).status).toBe(403);
    expect(mocks.sincronizar).not.toHaveBeenCalled();
  });
  it.each([false, true])("atualiza o painel também quando a consulta falha: %s", async falha => {
    const resultado = falha ? { erro: "ADN indisponível" } : { motivo: "Nenhuma nova NFS-e" };
    mocks.sincronizar.mockResolvedValue(resultado);
    const resposta = await POST();
    expect(resposta.status).toBe(falha ? 502 : 200);
    expect(await resposta.json()).toEqual(resultado);
    expect(mocks.revalidar).toHaveBeenCalledWith("/financeiro/manifesto-nfs");
  });
  it("não devolve detalhes internos quando a falha acontece antes da consulta", async () => {
    mocks.sincronizar.mockRejectedValue(new Error("postgres://segredo"));
    const resposta = await POST();
    expect(resposta.status).toBe(502);
    expect(await resposta.text()).not.toContain("segredo");
  });
});
