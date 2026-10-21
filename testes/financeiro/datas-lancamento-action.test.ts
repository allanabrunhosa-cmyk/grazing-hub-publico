vi.mock("server-only", () => ({}));
import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ criar: vi.fn(), consultar: vi.fn(), atualizar: vi.fn(), transacao: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => ({ userId: "usuario" })) }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: vi.fn() }));
vi.mock("@/lib/financeiro/baixarLancamento", () => ({ baixarLancamento: vi.fn() }));
vi.mock("@/lib/financeiro/custos-entrega", () => ({ exigirDespesaSemCustoEntrega: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: sim.transacao, lancamentoFinanceiro: { findUnique: sim.consultar } } }));
import { criarLancamentoAction, atualizarLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";

function formulario() {
  const f = new FormData();
  for (const [chave, valor] of Object.entries({ tipo: "DESPESA", descricao: "Contabilidade fictícia", valor: "3400", categoriaId: "categoria", dataCompetencia: "2026-09-30", dataVencimento: "2026-10-10" })) f.set(chave, valor);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  sim.criar.mockImplementation(async ({ data }) => ({ ...data, id: "ficticio", status: "PENDENTE" }));
  sim.consultar.mockResolvedValue({ status: "PENDENTE" });
  sim.atualizar.mockResolvedValue({ count: 1 });
  sim.transacao.mockImplementation(async executar => executar({ lancamentoFinanceiro: { create: sim.criar, updateMany: sim.atualizar } }));
});
it.each(["dataCompetencia", "dataVencimento", "dataPagamento", "parcelaVencimento"])("rejeita ano 0206 em %s antes de qualquer escrita", async campo => {
  const f = formulario();
  f.set(campo, "0206-10-10");
  if (campo === "dataPagamento") { f.set("jaBaixado", "on"); f.set("contaBancariaId", "conta"); }
  expect(await criarLancamentoAction(null, f)).toHaveProperty("erro");
  expect(sim.transacao).not.toHaveBeenCalled();
});
it.each(["2026-02-30", "2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "2201-01-01", "02026-10-10", ""])("não descarta nem normaliza parcela inválida %s", async data => {
  const f = formulario(); f.append("parcelaVencimento", "2026-10-10"); f.append("parcelaVencimento", data);
  expect(await criarLancamentoAction(null, f)).toHaveProperty("erro");
  expect(sim.criar).not.toHaveBeenCalled();
});
it.each(["dataCompetencia", "dataVencimento"])("também rejeita ano incompleto ao editar %s", async campo => {
  const f = formulario(); f.set(campo, "0206-10-10");
  expect(await atualizarLancamentoAction("ficticio", f)).toHaveProperty("erro");
  expect(sim.atualizar).not.toHaveBeenCalled();
});
it("conserva vencimento vazio como competência e aceita ano bissexto", async () => {
  const f = formulario(); f.set("dataCompetencia", "2028-02-29"); f.set("dataVencimento", "");
  expect(await criarLancamentoAction(null, f)).toEqual({ ok: true, ids: ["ficticio"] });
  const salvo = sim.criar.mock.calls[0][0].data;
  expect(salvo.dataVencimento).toEqual(salvo.dataCompetencia);
  expect(salvo.dataCompetencia.getFullYear()).toBe(2028);
});
it("preserva as datas completas das parcelas válidas", async () => {
  const f = formulario(); f.append("parcelaVencimento", "2026-10-10"); f.append("parcelaVencimento", "2026-11-10");
  expect(await criarLancamentoAction(null, f)).toEqual({ ok: true, ids: ["ficticio", "ficticio"] });
  expect(sim.criar.mock.calls.map(([arg]) => arg.data.dataVencimento.getMonth())).toEqual([9, 10]);
});
it("bloqueia competências recorrentes que ultrapassem o intervalo permitido", async () => {
  const f = formulario(); f.set("dataCompetencia", "2200-12-31"); f.append("parcelaVencimento", "2200-12-30"); f.append("parcelaVencimento", "2200-12-31");
  expect(await criarLancamentoAction(null, f)).toHaveProperty("erro");
  expect(sim.criar).not.toHaveBeenCalled();
});

it.each(["0001-01-01", "0206-10-10", "1900-01-01", "1999-12-31"])("bloqueia qualquer ano anterior a 2000: %s", async data => {
  const f = formulario(); f.set("dataVencimento", data);
  expect(await criarLancamentoAction(null, f)).toHaveProperty("erro");
  expect(sim.criar).not.toHaveBeenCalled();
});
it("aceita o início do limite em 01/01/2000", async () => {
  const f = formulario(); f.set("dataCompetencia", "2000-01-01"); f.set("dataVencimento", "2000-01-01");
  expect(await criarLancamentoAction(null, f)).toEqual({ ok: true, ids: ["ficticio"] });
});
