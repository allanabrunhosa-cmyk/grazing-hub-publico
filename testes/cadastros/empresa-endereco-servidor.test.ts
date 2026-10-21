import { beforeEach, describe, expect, it, vi } from "vitest";
const controles = vi.hoisted(() => ({ permissao: vi.fn(), sessao: vi.fn(), autor: vi.fn(), historico: vi.fn(), upsert: vi.fn(), lock: vi.fn(), antes: vi.fn(), revalidar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: controles.permissao }));
vi.mock("@/lib/session", () => ({ getSession: controles.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: controles.revalidar }));
vi.mock("@/lib/crypto", () => ({ cifrar: vi.fn(), decifrar: vi.fn() }));
vi.mock("@/lib/sefaz/certificado", () => ({ parsePfx: vi.fn(), invalidarCacheCertificado: vi.fn() }));
vi.mock("@/lib/vendas/cep", () => ({ consultarCepVenda: vi.fn() }));
vi.mock("@/lib/vendas/entregas", () => ({ autorEntregas: controles.autor }));
vi.mock("@/lib/vendas/persistencia", () => ({ historico: controles.historico }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ $executeRaw: controles.lock, configuracaoLoja: { findUnique: controles.antes, upsert: controles.upsert } }) } }));
import { salvarConfiguracaoLojaAction } from "@/app/(protegido)/configuracoes/actions";

const endereco = { cep: "01001000", logradouro: "Rua exclusivamente sintética", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const formulario = (alteracoes = {}) => { const f = new FormData(); f.set("nome", "Empresa sintética"); f.set("enderecoEstruturado", JSON.stringify({ ...endereco, ...alteracoes })); return f; };
beforeEach(() => { vi.clearAllMocks(); controles.sessao.mockResolvedValue({ userId: "admin-sintetico" }); controles.autor.mockResolvedValue({ userId: "admin-sintetico" }); controles.antes.mockResolvedValue({ id: "singleton", enderecoEstruturado: endereco }); controles.upsert.mockImplementation(async ({ update }) => ({ id: "singleton", ...update })); });
describe("Endereço da empresa pelo serviço normal", () => {
  it("grava IBGE resolvido e auditoria sem chamada fiscal ou efeitos comerciais", async () => {
    const rede = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Rede proibida"));
    try {
      expect(await salvarConfiguracaoLojaAction(null, formulario())).toEqual({ ok: true });
      expect(controles.permissao).toHaveBeenCalledWith("configuracoes.loja", "editar");
      expect(controles.autor).toHaveBeenCalledWith(expect.anything(), { userId: "admin-sintetico" }, "configuracoes.loja");
      expect(controles.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ enderecoEstruturado: expect.objectContaining({ codigoMunicipio: "3550308" }), versaoEntregas: { increment: 1 } }) }));
      expect(controles.historico).toHaveBeenCalledWith(expect.anything(), { userId: "admin-sintetico" }, "LOJA", "singleton", expect.anything(), expect.objectContaining({ enderecoEstruturado: expect.objectContaining({ codigoMunicipio: "3550308" }) }));
      expect(rede).not.toHaveBeenCalled();
    } finally { rede.mockRestore(); }
  });
  it("recusa código incompatível sem gravar nem auditar", async () => {
    expect(await salvarConfiguracaoLojaAction(null, formulario({ codigoMunicipio: "3304557" }))).toHaveProperty("erro");
    expect(controles.upsert).not.toHaveBeenCalled(); expect(controles.historico).not.toHaveBeenCalled();
  });
  it("mantém a verificação transacional da autorização", async () => {
    controles.autor.mockRejectedValueOnce(new Error("Acesso revogado"));
    expect(await salvarConfiguracaoLojaAction(null, formulario())).toHaveProperty("erro");
    expect(controles.upsert).not.toHaveBeenCalled();
  });
});
