import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sim = vi.hoisted(() => ({ sessao: vi.fn(), atividade: vi.fn(), transacao: vi.fn(), movimento: vi.fn(), saldo: vi.fn(), trava: vi.fn(), reservas: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: sim.atividade }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: sim.transacao } }));
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { DecimalEstoque } from "@/lib/estoque/quantidade";
const autor = { userId: "autor-validado", nome: "Autora fictícia" };
const tx = { $executeRaw: sim.trava, saldoEstoque: { upsert: sim.saldo }, movimentacaoEstoque: { create: sim.movimento }, reservaPedido: { aggregate: sim.reservas } };
const entrada = { insumoId: "insumo-ficticio", localId: "local-ficticio", tipo: "AJUSTE_ENTRADA" as const, quantidade: 2.5, criadoPorId: "autor-legado", data: new Date("2020-01-01T12:00:00Z") };
beforeEach(() => {
  vi.resetAllMocks(); sim.sessao.mockResolvedValue(autor); sim.atividade.mockResolvedValue(undefined);
  sim.saldo.mockResolvedValue({ quantidadeAtual: new DecimalEstoque(10.5) }); sim.movimento.mockResolvedValue({ id: "movimento-ficticio" });
  sim.reservas.mockResolvedValue({ _sum: { reservada: new DecimalEstoque(0) } });
  sim.transacao.mockImplementation(async executar => executar(tx));
});
describe("atividade da movimentação de estoque", () => {
  it("vincula referência enxuta e autor validado, mantendo data efetiva na origem", async () => {
    expect(await registrarMovimentacao(entrada)).toEqual({ movimentacaoId: "movimento-ficticio", saldoAnterior: 8, saldoNovo: 10.5 });
    expect(sim.atividade).toHaveBeenCalledExactlyOnceWith(tx, autor, expect.objectContaining({ acao: "AJUSTE_ENTRADA", fonteTabela: "MovimentacaoEstoque", fonteId: "movimento-ficticio" }));
    const evento = sim.atividade.mock.calls[0][2];
    expect(evento.antes).toBeUndefined(); expect(evento.depois).toBeUndefined(); expect(evento.ocorridoEm).toBeUndefined();
    expect(sim.movimento.mock.calls[0][0].data.createdAt).toEqual(entrada.data);
    expect(sim.atividade.mock.invocationCallOrder[0]).toBeGreaterThan(sim.movimento.mock.invocationCallOrder[0]);
  });
  it("sem sessão identifica rotina de sistema, nunca o criadoPorId legado", async () => {
    sim.sessao.mockResolvedValue(null); await registrarMovimentacao(entrada);
    expect(sim.atividade.mock.calls[0][1]).toEqual({ tipo: "SISTEMA", referencia: "Rotina de estoque" });
  });
  it("correlaciona movimentos da mesma perda sem usar correlação como chave de deduplicação", async () => {
    await registrarMovimentacao({ ...entrada, tipo: "SAIDA_PERDA", origemPerdaId: "perda-ficticia" });
    expect(sim.atividade.mock.calls[0][2]).toEqual(expect.objectContaining({ acao: "SAIDA_PERDA", correlacaoId: "perda-ficticia" }));
    expect(sim.atividade.mock.calls[0][2].deduplicacao).toBeUndefined();
  });
  it("falha na movimentação impede qualquer evento de sucesso", async () => {
    sim.movimento.mockRejectedValue(new Error("Falha sintética da movimentação"));
    await expect(registrarMovimentacao(entrada)).rejects.toThrow("Falha sintética da movimentação");
    expect(sim.atividade).not.toHaveBeenCalled();
  });
  it("falha da evidência propaga à transação do saldo e movimento", async () => {
    sim.atividade.mockRejectedValue(new Error("Falha sintética da evidência"));
    await expect(registrarMovimentacao(entrada)).rejects.toThrow("Falha sintética da evidência");
  });
  it("operação que recebeu transação usa a mesma fronteira para evento e saldo", async () => {
    await registrarMovimentacao({ ...entrada, tx: tx as never });
    expect(sim.transacao).not.toHaveBeenCalled(); expect(sim.atividade.mock.calls[0][0]).toBe(tx);
  });
  it("ator explícito de integração preserva iniciador sem sessão de navegador", async () => {
    const atorAtividade = { tipo: "INTEGRACAO" as const, referencia: "Rotina fictícia", iniciadorId: "iniciador-validado" };
    await registrarMovimentacao({ ...entrada, atorAtividade });
    expect(sim.sessao).not.toHaveBeenCalled(); expect(sim.atividade.mock.calls[0][1]).toEqual(atorAtividade);
  });
  it("erro real de leitura de identidade propaga sem inventar ator de sistema", async () => {
    sim.sessao.mockRejectedValue(new Error("Falha sintética de sessão"));
    await expect(registrarMovimentacao(entrada)).rejects.toThrow("Falha sintética de sessão");
    expect(sim.atividade).not.toHaveBeenCalled();
  });
});
