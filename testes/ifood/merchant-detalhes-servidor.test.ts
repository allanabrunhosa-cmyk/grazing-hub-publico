import { beforeEach, afterEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ requisicao: vi.fn(), usuario: {} as Record<string, unknown>, loja: {} as Record<string, unknown> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: async (fn: (tx: unknown) => unknown) => fn({ $executeRaw: async () => 1, usuario: { findUnique: async () => sim.usuario }, lojaIfood: { findUniqueOrThrow: async () => sim.loja } }),
  configuracaoLoja: { findUnique: async () => ({ fusoHorario: "America/Sao_Paulo" }) },
} }));
vi.mock("@/lib/ifood/tokens", () => ({ requisicaoAutorizada: sim.requisicao }));
vi.mock("@/lib/ifood/processamento", () => ({ hashIfood: vi.fn() }));
import { consultarDetalhesMerchant } from "@/lib/ifood/merchant";
import type { SessaoAtual } from "@/lib/session";
const merchant = "11111111-1111-4111-8111-111111111111", sessao = { userId: "usuario", versao: 0 } as SessaoAtual;
beforeEach(() => {
  vi.stubEnv("IFOOD_ATIVO", "1"); vi.stubEnv("IFOOD_PRODUCAO_AUTORIZADA", "0"); vi.stubEnv("IFOOD_ACOMPANHAMENTO_PRODUCAO_AUTORIZADO", "0");
  sim.usuario = { id: "usuario", nome: "Administrador sintético", ativo: true, excluidoEm: null, sessaoVersao: 0, perfilAcesso: { sistema: "ADMINISTRADOR" } };
  sim.loja = { id: "loja", ambiente: "TESTE", modoOperacao: "OPERACAO", merchantId: merchant, integracaoId: "integracao", autorizada: true, integracao: { contaId: "singleton" } };
  sim.requisicao.mockResolvedValue({ status: 200, dados: { id: merchant, name: "Loja sintética", clientSecret: "nao-expor" } });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("consulta apenas o merchant do vínculo e projeta resposta protegida", async () => {
  const r = await consultarDetalhesMerchant("loja", sessao);
  expect(sim.requisicao).toHaveBeenCalledExactlyOnceWith("integracao", "/merchant/v1.0/merchants/" + merchant);
  expect(r.detalhes.nome).toBe("Loja sintética"); expect(JSON.stringify(r)).not.toContain("nao-expor");
});
it("bloqueia antes do HTTP usuário sem permissão, conta estrangeira, revogação e produção", async () => {
  const originalUsuario = sim.usuario, originalLoja = sim.loja;
  sim.usuario = { ...originalUsuario, perfilAcesso: { sistema: null } };
  await expect(consultarDetalhesMerchant("loja", sessao)).rejects.toThrow(/acesso/);
  sim.usuario = originalUsuario; sim.loja = { ...originalLoja, integracao: { contaId: "outra-conta" } };
  await expect(consultarDetalhesMerchant("loja", sessao)).rejects.toThrow(/fora da conta/);
  sim.loja = { ...originalLoja, autorizada: false };
  await expect(consultarDetalhesMerchant("loja", sessao)).rejects.toThrow(/autorização/);
  sim.loja = { ...originalLoja, ambiente: "PRODUCAO" };
  await expect(consultarDetalhesMerchant("loja", sessao)).rejects.toThrow(/liberação/);
  expect(sim.requisicao).not.toHaveBeenCalled();
});
it("não retorna detalhes se a sessão é revogada durante a requisição", async () => {
  sim.requisicao.mockImplementation(async () => { sim.usuario.sessaoVersao = 1; return { status: 200, dados: { id: merchant, name: "Não retornar" } }; });
  await expect(consultarDetalhesMerchant("loja", sessao)).rejects.toThrow(/Sessão encerrada/);
});
it("recusa HTTP inesperado e identidade divergente", async () => {
  sim.requisicao.mockResolvedValueOnce({ status: 204, dados: null });
  await expect(consultarDetalhesMerchant("loja", sessao)).rejects.toThrow(/contrato/);
  sim.requisicao.mockResolvedValueOnce({ status: 200, dados: { id: "22222222-2222-4222-8222-222222222222" } });
  await expect(consultarDetalhesMerchant("loja", sessao)).rejects.toThrow(/outra loja/);
});
