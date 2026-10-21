import { expect, it, vi } from "vitest";
const simulados = vi.hoisted(() => ({ baixar: vi.fn(), revalidar: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: simulados.revalidar }));
vi.mock("@/lib/financeiro/baixarLancamento", () => ({ baixarLancamento: simulados.baixar, estornarBaixaLancamento: vi.fn() }));
import { baixarLancamentoAction } from "@/app/(protegido)/financeiro/contas/actions";

it("exige conta e data real antes de registrar a transação", async () => {
  for (const data of ["", "2026-02-30", "invalida"]) expect(await baixarLancamentoAction("id", "conta", data)).toHaveProperty("erro");
  expect(await baixarLancamentoAction("id", "", "2026-09-12")).toHaveProperty("erro");
  expect(simulados.baixar).not.toHaveBeenCalled();
});
it("encaminha a data confirmada e atualiza Movimentações", async () => {
  expect(await baixarLancamentoAction("id", "conta", "2026-09-12")).toEqual({ ok: true });
  expect(simulados.baixar).toHaveBeenCalledWith({ lancamentoId: "id", contaBancariaId: "conta", dataPagamento: new Date("2026-09-12T12:00:00") });
  expect(simulados.revalidar).toHaveBeenCalledWith("/financeiro/movimentacoes");
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));

it.each(["0206-10-10", "1900-01-01", "1999-12-31"])("bloqueia baixa em ano anterior a 2000: %s", async data => {
  expect(await baixarLancamentoAction("id", "conta", data)).toHaveProperty("erro");
  expect(simulados.baixar).not.toHaveBeenCalled();
});
