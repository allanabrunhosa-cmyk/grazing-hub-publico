import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sim = vi.hoisted(() => ({ sessao: vi.fn(), guarda: vi.fn(), atividade: vi.fn(), transacao: vi.fn(), criar: vi.fn(), consultar: vi.fn(), consultarTx: vi.fn(), atualizar: vi.fn(), atualizarUm: vi.fn(), movimento: vi.fn(), apagarMovimentos: vi.fn(), vinculo: vi.fn(), revalidar: vi.fn(), trava: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: sim.atividade }));
vi.mock("@/lib/financeiro/custos-entrega", () => ({ exigirDespesaSemCustoEntrega: vi.fn() }));
vi.mock("@/lib/ifood/acompanhamento", () => ({ exigirEfeitoOperacional: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: sim.revalidar }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: sim.transacao, lancamentoFinanceiro: { findUnique: sim.consultar } } }));
import { criarLancamentoAction, atualizarLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";
import { baixarLancamento, estornarBaixaLancamento } from "@/lib/financeiro/baixarLancamento";
import { Prisma } from "@/generated/prisma/client";

const autor = { userId: "autor-validado", nome: "Autora fictícia", admin: false, permissoes: {}, excecoes: {}, perfilNome: "Equipe", email: "autor@example.invalid" };
const lancamento = () => ({ id: "lancamento-ficticio", tipo: "DESPESA", valor: new Prisma.Decimal("120.50"), descricao: "Descrição fictícia", categoriaId: "categoria", dataCompetencia: new Date("2026-10-01T12:00:00Z"), dataVencimento: new Date("2026-10-10T12:00:00Z"), dataPagamento: null, status: "PENDENTE", itemFaturaId: null, pedidoVendaId: null, vinculoExtrato: null });
const tx = { $queryRaw: sim.trava, $executeRaw: sim.trava, lancamentoFinanceiro: { create: sim.criar, findUniqueOrThrow: sim.consultarTx, updateMany: sim.atualizar, update: sim.atualizarUm }, movimentacaoBancaria: { create: sim.movimento, deleteMany: sim.apagarMovimentos }, vinculoExtrato: { findUnique: sim.vinculo } };
function formulario() {
  const f = new FormData();
  for (const [campo, valor] of Object.entries({ tipo: "DESPESA", descricao: "Compra fictícia", valor: "120,50", categoriaId: "categoria", dataCompetencia: "2026-10-01", dataVencimento: "2026-10-10", userId: "id-enviado-pelo-navegador", observacoes: "Observação que não deve entrar no evento" })) f.set(campo, valor);
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  sim.sessao.mockResolvedValue(autor); sim.guarda.mockResolvedValue(autor); sim.atividade.mockResolvedValue(undefined);
  sim.consultar.mockResolvedValue(lancamento()); sim.consultarTx.mockResolvedValue(lancamento()); sim.vinculo.mockResolvedValue(null);
  sim.atualizar.mockResolvedValue({ count: 1 }); sim.atualizarUm.mockResolvedValue(lancamento());
  sim.criar.mockImplementation(async ({ data }) => ({ ...lancamento(), ...data, id: `lancamento-${sim.criar.mock.calls.length}`, valor: new Prisma.Decimal(data.valor) }));
  sim.transacao.mockImplementation(async executar => executar(tx));
});

describe("evidência financeira transacional", () => {
  it("cria com autor da sessão e metadados financeiros permitidos, sem observação livre", async () => {
    expect(await criarLancamentoAction(null, formulario())).toEqual({ ok: true, ids: ["lancamento-1"] });
    expect(sim.atividade).toHaveBeenCalledExactlyOnceWith(tx, autor, expect.objectContaining({ acao: "CRIACAO", entidadeId: "lancamento-1", depois: expect.objectContaining({ valor: "120.5", status: "PENDENTE" }) }));
    const evento = sim.atividade.mock.calls[0][2];
    expect(JSON.stringify(evento)).not.toContain("Observação");
    expect(sim.criar.mock.calls[0][0].data.criadoPorId).toBe("autor-validado");
    expect(JSON.stringify(sim.atividade.mock.calls)).not.toContain("id-enviado-pelo-navegador");
  });
  it("mantém eventos distintos para parcelas relacionadas da mesma operação", async () => {
    const f = formulario(); f.append("parcelaVencimento", "2026-10-10"); f.append("parcelaVencimento", "2026-11-10");
    expect(await criarLancamentoAction(null, f)).toEqual({ ok: true, ids: ["lancamento-1", "lancamento-2"] });
    const eventos = sim.atividade.mock.calls.map(c => c[2]);
    expect(eventos).toHaveLength(2); expect(new Set(eventos.map(e => e.entidadeId)).size).toBe(2);
    expect(eventos[0].correlacaoId).toBeTruthy(); expect(eventos[1].correlacaoId).toBe(eventos[0].correlacaoId);
    expect(eventos.every(e => e.deduplicacao === undefined)).toBe(true);
  });
  it("não retorna sucesso nem revalida após falha do registro na transação", async () => {
    sim.atividade.mockRejectedValue(new Error("Falha sintética do gravador"));
    expect(await criarLancamentoAction(null, formulario())).toEqual({ erro: "Não foi possível salvar o lançamento." });
    expect(sim.revalidar).not.toHaveBeenCalled();
  });
  it("antes/depois da edição usam o registro relido dentro da transação", async () => {
    sim.consultarTx.mockResolvedValue({ ...lancamento(), valor: new Prisma.Decimal("90.30") });
    expect(await atualizarLancamentoAction("lancamento-ficticio", formulario())).toEqual({ ok: true });
    expect(sim.atividade).toHaveBeenCalledExactlyOnceWith(tx, autor, expect.objectContaining({ acao: "EDICAO", antes: expect.objectContaining({ valor: "90.3" }), depois: expect.objectContaining({ valor: "120.5" }) }));
  });
  it("não grava evidência de edição quando o update condicional perdeu a corrida", async () => {
    sim.atualizar.mockResolvedValue({ count: 0 });
    expect(await atualizarLancamentoAction("lancamento-ficticio", formulario())).toHaveProperty("erro");
    expect(sim.atividade).not.toHaveBeenCalled(); expect(sim.revalidar).not.toHaveBeenCalled();
  });
  it("baixa avulsa grava evidência após a movimentação na mesma transação", async () => {
    await baixarLancamento({ lancamentoId: "lancamento-ficticio", contaBancariaId: "conta-ficticia", dataPagamento: new Date("2026-10-10T12:00:00Z") });
    expect(sim.atividade).toHaveBeenCalledExactlyOnceWith(tx, autor, expect.objectContaining({ acao: "BAIXA", antes: { status: "PENDENTE" }, depois: expect.objectContaining({ status: "BAIXADO", valor: "120.5" }) }));
    expect(sim.movimento.mock.invocationCallOrder[0]).toBeLessThan(sim.atividade.mock.invocationCallOrder[0]);
  });
  it.each([{ auditoriaOrigem: true as const }, { origemPedido: true as const }])("reaproveita evidência de origem da baixa %j sem registrar outra", async origem => {
    await baixarLancamento({ lancamentoId: "lancamento-ficticio", contaBancariaId: "conta-ficticia", ...origem });
    expect(sim.movimento).toHaveBeenCalledOnce(); expect(sim.atividade).not.toHaveBeenCalled();
  });
  it("baixa rejeitada antes de atualizar não tem evento de sucesso", async () => {
    sim.consultarTx.mockResolvedValue({ ...lancamento(), status: "BAIXADO" });
    await expect(baixarLancamento({ lancamentoId: "lancamento-ficticio", contaBancariaId: "conta-ficticia" })).rejects.toThrow("já foi baixado");
    expect(sim.atividade).not.toHaveBeenCalled(); expect(sim.movimento).not.toHaveBeenCalled();
  });
  it("erro da evidência da baixa propaga para permitir rollback, sem promise solta", async () => {
    sim.atividade.mockRejectedValue(new Error("Falha de evidência"));
    await expect(baixarLancamento({ lancamentoId: "lancamento-ficticio", contaBancariaId: "conta-ficticia" })).rejects.toThrow("Falha de evidência");
  });
  it("estorno avulso preserva estado anterior e autor validado", async () => {
    sim.consultarTx.mockResolvedValue({ ...lancamento(), status: "BAIXADO", dataPagamento: new Date("2026-10-09T12:00:00Z") });
    await estornarBaixaLancamento({ lancamentoId: "lancamento-ficticio" });
    expect(sim.atividade).toHaveBeenCalledExactlyOnceWith(tx, autor, expect.objectContaining({ acao: "ESTORNO_BAIXA", antes: expect.objectContaining({ status: "BAIXADO" }), depois: { status: "PENDENTE" } }));
  });
  it("ausência confirmada de sessão identifica rotina, sem atribuí-la ao criador legado", async () => {
    sim.sessao.mockResolvedValue(null); sim.consultarTx.mockResolvedValue({ ...lancamento(), criadoPorId: "administrador-legado" });
    await baixarLancamento({ lancamentoId: "lancamento-ficticio", contaBancariaId: "conta-ficticia" });
    expect(sim.atividade.mock.calls[0][1]).toEqual({ tipo: "SISTEMA", referencia: "Rotina financeira" });
  });
  it("identidade explícita de integração preserva iniciador e dispensa sessão de navegador", async () => {
    const atorAtividade = { tipo: "INTEGRACAO" as const, referencia: "Integração fictícia", iniciadorId: "iniciador-validado" };
    await baixarLancamento({ lancamentoId: "lancamento-ficticio", contaBancariaId: "conta-ficticia", atorAtividade });
    expect(sim.sessao).not.toHaveBeenCalled(); expect(sim.atividade.mock.calls[0][1]).toEqual(atorAtividade);
  });
  it("falha real da releitura de sessão impede baixa com autoria incorreta", async () => {
    sim.sessao.mockRejectedValue(new Error("Falha sintética de identidade"));
    await expect(baixarLancamento({ lancamentoId: "lancamento-ficticio", contaBancariaId: "conta-ficticia" })).rejects.toThrow("Falha sintética de identidade");
    expect(sim.atividade).not.toHaveBeenCalled();
  });
});
