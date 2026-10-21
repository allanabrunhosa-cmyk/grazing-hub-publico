vi.mock("server-only", () => ({}));
import { beforeEach, expect, it, vi } from "vitest";
const simulados = vi.hoisted(() => ({ consultar: vi.fn(), contar: vi.fn(), atualizar: vi.fn(), sessao: vi.fn(), revalidar: vi.fn(), criarMovimento: vi.fn(), auditar: vi.fn(), atividade: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: simulados.revalidar }));
vi.mock("@/lib/session", () => ({ getSession: simulados.sessao }));
vi.mock("@/lib/prisma", () => {
  const tx = { historicoAcesso: { create: simulados.auditar }, atividadeUsuario: { create: simulados.atividade }, $executeRaw: vi.fn(), lancamentoFinanceiro: { findUnique: simulados.consultar, findUniqueOrThrow: simulados.consultar, count: simulados.contar, updateMany: simulados.atualizar }, movimentacaoBancaria: { create: simulados.criarMovimento } };
  return { prisma: { ...tx, $transaction: async (executar: (cliente: typeof tx) => Promise<unknown>) => executar(tx) } };
});
import { excluirLancamentoAction, obterResumoExclusaoLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";
import { baixarLancamento } from "@/lib/financeiro/baixarLancamento";

const lancamento = { id: "parcela-2", status: "PENDENTE", descricao: "Aluguel (2/5)", recorrenciaGrupoId: "grupo-1", notaFiscalItemLancamento: null, tipo: "DESPESA", valor: 100, dataCompetencia: new Date("2026-09-01T12:00:00Z"), dataVencimento: new Date("2026-09-15T12:00:00Z") };
beforeEach(() => {
  vi.resetAllMocks();
  simulados.sessao.mockResolvedValue({ userId: "usuario", nome: "Usuário sintético" });
  simulados.consultar.mockResolvedValue(lancamento);
  simulados.atualizar.mockResolvedValue({ count: 1 });
});
it("consulta quantidades de todo o grupo, sem limitar pelo filtro de datas da tela", async () => {
  simulados.contar.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
  expect(await obterResumoExclusaoLancamentoAction("parcela-2")).toEqual({ descricao: lancamento.descricao, grupo: "RECORRENCIA", pendentes: 4, realizados: 1 });
  expect(simulados.contar).toHaveBeenCalledWith({ where: { recorrenciaGrupoId: "grupo-1", status: "PENDENTE" } });
});
it("exige escolha explícita no servidor para parcelas ou recorrências", async () => {
  expect(await excluirLancamentoAction("parcela-2")).toHaveProperty("erro");
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it("apenas esta nunca atualiza o grupo", async () => {
  expect(await excluirLancamentoAction("parcela-2", "APENAS_ESTA")).toEqual({ ok: true, quantidade: 1 });
  expect(simulados.atualizar).toHaveBeenCalledExactlyOnceWith({ where: { id: "parcela-2", status: "PENDENTE", itemFaturaId: null, pedidoVendaId: null }, data: { status: "CANCELADO" } });
});
it("exclui as outras pendentes pelo vínculo, preservando realizadas e outros grupos", async () => {
  simulados.atualizar.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 3 });
  expect(await excluirLancamentoAction("parcela-2", "GRUPO_PENDENTE")).toEqual({ ok: true, quantidade: 4 });
  expect(simulados.atualizar).toHaveBeenNthCalledWith(2, { where: { recorrenciaGrupoId: "grupo-1", status: "PENDENTE", itemFaturaId: null, pedidoVendaId: null, id: { not: "parcela-2" } }, data: { status: "CANCELADO" } });
  expect(simulados.revalidar).toHaveBeenCalledWith("/financeiro/movimentacoes");
  expect(simulados.revalidar).toHaveBeenCalledWith("/financeiro/fluxo-de-caixa");
});
it("bloqueia exclusão isolada de parcela de compra sem confirmar a reversão integral", async () => {
  simulados.consultar.mockResolvedValue({ ...lancamento, recorrenciaGrupoId: null, notaFiscalItemLancamento: { notaFiscalItemId: "item-nota", notaFiscalItem: { notaFiscalId: "nota" } } });
  expect(await excluirLancamentoAction("parcela-2", "GRUPO_PENDENTE")).toHaveProperty("erro");
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it("mantém exclusão simples para movimentação avulsa e rejeita grupo inexistente", async () => {
  simulados.consultar.mockResolvedValue({ ...lancamento, recorrenciaGrupoId: null });
  expect(await excluirLancamentoAction("parcela-2", "GRUPO_PENDENTE")).toHaveProperty("erro");
  expect(await excluirLancamentoAction("parcela-2")).toEqual({ ok: true, quantidade: 1 });
});
it.each(["BAIXADO", "CANCELADO"])("não exclui nem dispara exclusão do grupo se a selecionada está %s", async (status) => {
  simulados.consultar.mockResolvedValue({ ...lancamento, status });
  expect(await excluirLancamentoAction("parcela-2", "GRUPO_PENDENTE")).toHaveProperty("erro");
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it("impede exclusão de grupo quando a selecionada muda durante a confirmação", async () => {
  simulados.atualizar.mockResolvedValue({ count: 0 });
  expect(await excluirLancamentoAction("parcela-2", "GRUPO_PENDENTE")).toHaveProperty("erro");
  expect(simulados.atualizar).toHaveBeenCalledTimes(1);
});
it("impede que uma baixa concorrente recrie a parcela excluída", async () => {
  simulados.atualizar.mockResolvedValue({ count: 0 });
  await expect(baixarLancamento({ lancamentoId: "parcela-2", contaBancariaId: "banco" })).rejects.toThrow("mudou ou foi excluído");
  expect(simulados.criarMovimento).not.toHaveBeenCalled();
});
it("mantém a criação da movimentação bancária numa baixa válida", async () => {
  const dataPagamento = new Date("2026-09-10T12:00:00Z");
  await baixarLancamento({ lancamentoId: "parcela-2", contaBancariaId: "banco", dataPagamento });
  expect(simulados.criarMovimento).toHaveBeenCalledWith({ data: { contaBancariaId: "banco", tipo: "SAIDA", valor: 100, data: dataPagamento, descricao: lancamento.descricao, lancamentoId: "parcela-2" } });
  expect(simulados.atividade).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ autorId: "usuario", autorNome: "Usuário sintético", acao: "BAIXA", entidadeId: "parcela-2", resultado: "SUCESSO" }) });
});
it("exige sessão inclusive na consulta de parcelas", async () => {
  simulados.sessao.mockResolvedValue(null);
  expect(await obterResumoExclusaoLancamentoAction("parcela-2")).toHaveProperty("erro");
  expect(await excluirLancamentoAction("parcela-2", "GRUPO_PENDENTE")).toHaveProperty("erro");
  expect(simulados.consultar).not.toHaveBeenCalled();
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));

it("recusa excluir título de Pedido pelo Financeiro genérico", async () => {
  simulados.consultar.mockResolvedValue({ ...lancamento, pedidoVendaId: "pedido-ficticio" });
  expect(await excluirLancamentoAction("parcela-2", "GRUPO_PENDENTE")).toEqual({ erro: "Título vinculado a Pedido deve ser alterado pelo Pedido." });
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it("impede cancelar despesa rateada em Pedido antes de desvincular", async () => {
  simulados.contar.mockResolvedValueOnce(1);
  expect(await excluirLancamentoAction("parcela-2", "APENAS_ESTA")).toMatchObject({ erro: expect.stringContaining("Desvincule o custo") });
  expect(simulados.atualizar).not.toHaveBeenCalled();
});

it("registra o cancelamento avulso na mesma transação com autor, origem e datas", async () => {
  simulados.consultar.mockResolvedValue({ ...lancamento, recorrenciaGrupoId: null });
  expect(await excluirLancamentoAction("parcela-2")).toEqual({ ok: true, quantidade: 1 });
  expect(simulados.auditar).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({
    autorId: "usuario", entidade: "LANCAMENTO_FINANCEIRO", entidadeId: "parcela-2", acao: "CANCELAMENTO",
    antes: expect.objectContaining({ status: "PENDENTE", dataVencimento: "2026-09-15T12:00:00.000Z" }),
    depois: expect.objectContaining({ status: "CANCELADO", quantidade: 1 }),
  }) });
});
it("não confirma o cancelamento se a auditoria falhar", async () => {
  simulados.consultar.mockResolvedValue({ ...lancamento, recorrenciaGrupoId: null });
  simulados.auditar.mockRejectedValueOnce(new Error("Falha de auditoria"));
  expect(await excluirLancamentoAction("parcela-2")).toHaveProperty("erro");
  expect(simulados.revalidar).not.toHaveBeenCalled();
});
