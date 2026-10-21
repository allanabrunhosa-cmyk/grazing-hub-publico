import { beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ acesso: vi.fn(), obter: vi.fn(), configurar: vi.fn(), revalidar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: s.revalidar }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: s.acesso }));
vi.mock("@/lib/fiscal-saida/brasilnfe/configuracao", () => ({ obterConfiguracaoBrasilNfe: vi.fn(), salvarConfiguracaoBrasilNfe: vi.fn(), validarConexaoBrasilNfe: vi.fn() }));
vi.mock("@/lib/fiscal-saida/brasilnfe/pre-requisitos", () => ({ obterPreRequisitosBrasilNfe: vi.fn(), registrarEvidenciaPainelBrasilNfe: vi.fn(), verificarPreRequisitosBrasilNfe: vi.fn() }));
vi.mock("@/lib/fiscal-saida/brasilnfe/operacional", async () => ({ obterHabilitacaoEmissaoBrasilNfe: s.obter, configurarHabilitacaoEmissaoBrasilNfe: s.configurar, ...await import("@/lib/fiscal-saida/brasilnfe/operacional-dominio") }));
import { configurarHabilitacaoEmissaoBrasilNfeAction, obterHabilitacaoEmissaoBrasilNfeAction } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe-actions";
beforeEach(() => { vi.clearAllMocks(); s.acesso.mockResolvedValue({ userId: "responsavel-ficticio", versao: 1 }); s.obter.mockResolvedValue({ homologacao: null, producao: null, automatica: false, callback: false }); s.configurar.mockResolvedValue({}); });
it("leitura exige configuração e capacidade fiscal central antes do serviço", async () => {
  expect((await obterHabilitacaoEmissaoBrasilNfeAction()).ok).toBe(true);
  expect(s.acesso.mock.calls).toEqual([["configuracoes.brasilnfe", "visualizar"], ["vendas.fiscal", "editar"]]); expect(s.configurar).not.toHaveBeenCalled();
});
it("escrita exige os dois recursos e retorna somente o controle local", async () => {
  const comando = { ambiente: "HOMOLOGACAO", habilitada: true }; await configurarHabilitacaoEmissaoBrasilNfeAction(comando);
  expect(s.acesso.mock.calls).toEqual([["configuracoes.brasilnfe", "editar"], ["vendas.fiscal", "editar"]]); expect(s.configurar).toHaveBeenCalledWith(comando, { userId: "responsavel-ficticio", versao: 1 });
});
it("nega acesso fiscal sem gravar e sem converter negação em estado válido", async () => {
  s.acesso.mockResolvedValueOnce({ userId: "ficticio" }).mockRejectedValueOnce(new Error("negado"));
  await expect(configurarHabilitacaoEmissaoBrasilNfeAction({})).rejects.toThrow("negado"); expect(s.configurar).not.toHaveBeenCalled(); expect(s.obter).not.toHaveBeenCalled();
});
it("erro desconhecido nunca expõe Error, cause ou conteúdo estrangeiro", async () => {
  s.configurar.mockRejectedValueOnce(new Error("token-exclusivo-fixture senha CSC", { cause: "user-exclusivo-fixture" }));
  const r = await configurarHabilitacaoEmissaoBrasilNfeAction({}); expect(r).toEqual({ ok: false, erro: "Não foi possível atualizar a habilitação manual. Nenhuma nota foi transmitida." });
  expect(JSON.stringify(r)).not.toMatch(/token-exclusivo|senha|CSC|user-exclusivo|cause/);
});
