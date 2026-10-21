import { beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn(), tx: vi.fn(), registrar: vi.fn(), contexto: vi.fn(), historico: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: s.sessao }));
vi.mock("@/lib/atividades/autenticacao", () => ({ registrarAutenticacao: s.registrar }));
vi.mock("@/lib/atividades/registro", () => ({ definirContextoAtividade: s.contexto }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: s.tx } }));
import { salvarPerfilAcesso } from "@/app/(protegido)/configuracoes/usuarios/actions";
const sessao = { userId: "autor-validado", nome: "Pessoa sintética", versao: 2 };
beforeEach(() => {
  vi.resetAllMocks(); s.sessao.mockResolvedValue(sessao);
  s.usuario.mockResolvedValue({ id: sessao.userId, ativo: true, excluidoEm: null, sessaoVersao: 2, permissoesPersonalizadas: {}, perfilAcesso: { sistema: null, permissoes: {} } });
  s.tx.mockImplementation(async (operacao) => operacao({ $executeRaw: vi.fn(), usuario: { findUnique: s.usuario }, historicoAcesso: { create: s.historico } }));
});
it("gestão revalida autorização na transação e registra recusa fora dela com autor confirmado", async () => {
  const resposta = await salvarPerfilAcesso({ nome: "Perfil sintético", descricao: "", permissoes: {} });
  expect(resposta).toEqual({ erro: "Seu acesso não permite esta ação." });
  expect(s.registrar).toHaveBeenCalledWith(sessao, "AUTORIZACAO_NEGADA");
  expect(s.usuario).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "autor-validado" } }));
  expect(s.contexto).not.toHaveBeenCalled(); expect(s.historico).not.toHaveBeenCalled();
  expect(s.usuario.mock.invocationCallOrder[0]).toBeLessThan(s.registrar.mock.invocationCallOrder[0]);
});
it("sessão revogada não gera sucesso nem atribui operação à identidade desatualizada", async () => {
  s.usuario.mockResolvedValue({ ativo: false, sessaoVersao: 3 });
  expect(await salvarPerfilAcesso({ nome: "Perfil sintético", descricao: "", permissoes: {} })).toEqual({ erro: "Sua sessão foi encerrada." });
  expect(s.registrar).not.toHaveBeenCalled(); expect(s.historico).not.toHaveBeenCalled();
});
