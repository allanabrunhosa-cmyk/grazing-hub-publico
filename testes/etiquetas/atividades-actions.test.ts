import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sim = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn(), guarda: vi.fn(), tentativa: vi.fn(), atualizar: vi.fn(), atualizarTrabalho: vi.fn(), transacao: vi.fn(), atividade: vi.fn(), contexto: vi.fn(), revalidar: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: sim.atividade, definirContextoAtividade: sim.contexto }));
vi.mock("next/cache", () => ({ revalidatePath: sim.revalidar }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: sim.usuario }, tentativaEtiqueta: { findFirst: sim.tentativa }, $transaction: sim.transacao } }));
import { finalizarTentativaEtiquetaAction } from "@/app/(protegido)/producao/etiquetas/actions";
const usuario = { id: "operador-validado", nome: "Operadora fictícia", ativo: true, excluidoEm: null };
const tentativa = { id: "tentativa-ficticia", resultado: "INICIADA", trabalho: { id: "trabalho-ficticio", status: "ENVIANDO" } };
const tx = { tentativaEtiqueta: { updateMany: sim.atualizar }, trabalhoEtiqueta: { update: sim.atualizarTrabalho } };
beforeEach(() => {
  vi.resetAllMocks(); sim.sessao.mockResolvedValue({ userId: usuario.id }); sim.usuario.mockResolvedValue(usuario);
  sim.tentativa.mockResolvedValue(tentativa); sim.atualizar.mockResolvedValue({ count: 1 }); sim.atividade.mockResolvedValue(undefined);
  sim.transacao.mockImplementation(async executar => executar(tx));
});
describe("resultado relatado de envio da etiqueta", () => {
  it("envio relatado registra solicitação, sem declarar confirmação física", async () => {
    expect(await finalizarTentativaEtiquetaAction(tentativa.id, "SUCESSO")).toEqual({ ok: true });
    expect(sim.tentativa).toHaveBeenCalledWith(expect.objectContaining({ where: { id: tentativa.id, solicitadoPorId: usuario.id, trabalho: { lojaId: "singleton" } } }));
    expect(sim.atividade).toHaveBeenCalledExactlyOnceWith(tx, { userId: usuario.id, nome: usuario.nome }, expect.objectContaining({ acao: "ENVIO_RELATADO", resultado: "SOLICITADO", correlacaoId: tentativa.id, deduplicacao: `etiqueta-finalizada:${tentativa.id}` }));
    expect(sim.atividade.mock.calls[0][2].resumo).toContain("impressão física não confirmada");
  });
  it("falha é resultado próprio e não copia erro livre no evento central", async () => {
    expect(await finalizarTentativaEtiquetaAction(tentativa.id, "FALHA", "Erro local fictício")).toEqual({ ok: true });
    expect(sim.atividade.mock.calls[0][2]).toEqual(expect.objectContaining({ acao: "ENVIO_FALHOU", resultado: "FALHA" }));
    expect(JSON.stringify(sim.atividade.mock.calls[0][2])).not.toContain("Erro local fictício");
  });
  it("envio incerto permanece solicitado, sem afirmar falha ou impressão física", async () => {
    expect(await finalizarTentativaEtiquetaAction(tentativa.id, "INCERTO")).toEqual({ ok: true });
    expect(sim.atividade.mock.calls[0][2]).toEqual(expect.objectContaining({ acao: "ENVIO_INCERTO", resultado: "SOLICITADO" }));
    expect(sim.atividade.mock.calls[0][2].resumo).toContain("impressão física não confirmada");
  });
  it("retry concluído é idempotente antes da transação", async () => {
    sim.tentativa.mockResolvedValue({ ...tentativa, resultado: "SUCESSO" });
    expect(await finalizarTentativaEtiquetaAction(tentativa.id, "SUCESSO")).toEqual({ ok: true });
    expect(sim.transacao).not.toHaveBeenCalled(); expect(sim.atividade).not.toHaveBeenCalled();
  });
  it("concorrência vencida por outro pedido não gera segunda evidência", async () => {
    sim.atualizar.mockResolvedValue({ count: 0 });
    expect(await finalizarTentativaEtiquetaAction(tentativa.id, "SUCESSO")).toEqual({ ok: true });
    expect(sim.atividade).not.toHaveBeenCalled(); expect(sim.atualizarTrabalho).not.toHaveBeenCalled();
  });
  it("sem tentativa pertencente ao autor, não permite registrar resultado", async () => {
    sim.tentativa.mockResolvedValue(null);
    expect(await finalizarTentativaEtiquetaAction("tentativa-alheia", "SUCESSO")).toHaveProperty("erro");
    expect(sim.transacao).not.toHaveBeenCalled(); expect(sim.atividade).not.toHaveBeenCalled();
  });
  it("falha do gravador impede sucesso e revalidação", async () => {
    sim.atividade.mockRejectedValue(new Error("Falha sintética da evidência"));
    expect(await finalizarTentativaEtiquetaAction(tentativa.id, "SUCESSO")).toEqual({ erro: "Falha sintética da evidência" });
    expect(sim.revalidar).not.toHaveBeenCalled(); expect(sim.atualizarTrabalho).not.toHaveBeenCalled();
  });
  it("autorização é exigida antes de consultar tentativa e dados do ator", async () => {
    sim.guarda.mockRejectedValue(new Error("Acesso negado"));
    await expect(finalizarTentativaEtiquetaAction(tentativa.id, "SUCESSO")).rejects.toThrow("Acesso negado");
    expect(sim.tentativa).not.toHaveBeenCalled(); expect(sim.usuario).not.toHaveBeenCalled();
  });
});
