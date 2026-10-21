import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), conta: vi.fn(), listar: vi.fn(), bloquear: vi.fn(), baixar: vi.fn(), revalidar: vi.fn(), transacao: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidar }));
vi.mock("@/lib/financeiro/baixarLancamento", () => ({ baixarLancamento: mocks.baixar }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transacao } }));
import { baixarNotaFiscalAction } from "@/app/(protegido)/financeiro/movimentacoes/baixar-nota";
const tx = { contaBancaria: { findUnique: mocks.conta }, lancamentoFinanceiro: { findMany: mocks.listar }, $queryRaw: mocks.bloquear };
const registros = ["a", "b"].map((id) => ({ id, valor: 50, tipo: "DESPESA", status: "PENDENTE", dataVencimento: new Date("2026-09-10T12:00:00Z"), notaFiscalItemLancamento: { notaFiscalDuplicata: { id: "duplicata", valor: 100 }, notaFiscalItem: { notaFiscalId: "nota" } } }));
beforeEach(() => {
  vi.resetAllMocks(); mocks.sessao.mockResolvedValue({ id: "usuario" }); mocks.conta.mockResolvedValue({ ativo: true });
  mocks.listar.mockResolvedValueOnce(registros).mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
  mocks.transacao.mockImplementation(async (executar) => executar(tx));
});
it("exige sessão antes de ler ou alterar dados", async () => {
  mocks.sessao.mockResolvedValue(null);
  expect(await baixarNotaFiscalAction(["a", "b"], "conta", "2026-09-12", -100)).toHaveProperty("erro");
  expect(mocks.transacao).not.toHaveBeenCalled();
});
it("rejeita IDs repetidos e datas inválidas", async () => {
  expect(await baixarNotaFiscalAction(["a", "a"], "conta", "2026-09-12", -100)).toHaveProperty("erro");
  expect(await baixarNotaFiscalAction(["a", "b"], "conta", "2026-02-30", -100)).toHaveProperty("erro");
  expect(mocks.transacao).not.toHaveBeenCalled();
});
it("baixa todos os itens na mesma transação com a conta e data confirmadas", async () => {
  expect(await baixarNotaFiscalAction(["b", "a"], "conta", "2026-09-12", -100)).toEqual({ ok: true });
  expect(mocks.bloquear).toHaveBeenCalledOnce();
  expect(mocks.baixar).toHaveBeenCalledTimes(2);
  expect(mocks.baixar).toHaveBeenNthCalledWith(1, { lancamentoId: "a", contaBancariaId: "conta", dataPagamento: new Date("2026-09-12T12:00:00"), tx });
  expect(mocks.revalidar).toHaveBeenCalledWith("/financeiro/movimentacoes");
});
it.each(["outra nota", "realizado", "outro dia", "valor alterado", "novo item", "conta inativa"])("bloqueia uma confirmação desatualizada: %s", async (caso) => {
  mocks.listar.mockReset();
  const alterados = structuredClone(registros);
  if (caso === "outra nota") alterados[1].notaFiscalItemLancamento.notaFiscalItem.notaFiscalId = "outra";
  if (caso === "realizado") alterados[1].status = "BAIXADO";
  if (caso === "outro dia") alterados[1].dataVencimento = new Date("2026-09-11T12:00:00Z");
  if (caso === "valor alterado") alterados[1].valor = 55;
  if (caso === "conta inativa") mocks.conta.mockResolvedValue({ ativo: false });
  mocks.listar.mockResolvedValueOnce(alterados).mockResolvedValueOnce(caso === "novo item" ? [{ id: "a" }, { id: "b" }, { id: "c" }] : [{ id: "a" }, { id: "b" }]);
  expect(await baixarNotaFiscalAction(["a", "b"], "conta", "2026-09-12", -100)).toHaveProperty("erro");
  expect(mocks.baixar).not.toHaveBeenCalled();
});
it("rejeita quando a composição não fecha com o valor final da parcela", async () => {
  mocks.listar.mockReset();
  const alterados = structuredClone(registros);
  alterados[0].notaFiscalItemLancamento.notaFiscalDuplicata.valor = 95;
  alterados[1].notaFiscalItemLancamento.notaFiscalDuplicata.valor = 95;
  mocks.listar.mockResolvedValueOnce(alterados).mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
  expect(await baixarNotaFiscalAction(["a", "b"], "conta", "2026-09-12", -95)).toEqual({ erro: "A composição dos itens não fecha com o valor final da parcela. Revise a nota fiscal antes de confirmar." });
  expect(mocks.baixar).not.toHaveBeenCalled();
});
it("propaga a falha para a transação desfazer o grupo inteiro", async () => {
  mocks.baixar.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Conflito"));
  let desfeita = false;
  mocks.transacao.mockImplementation(async (executar) => { try { return await executar(tx); } catch (erro) { desfeita = true; throw erro; } });
  expect(await baixarNotaFiscalAction(["a", "b"], "conta", "2026-09-12", -100)).toEqual({ erro: "Conflito" });
  expect(desfeita).toBe(true);
  expect(mocks.revalidar).not.toHaveBeenCalled();
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
