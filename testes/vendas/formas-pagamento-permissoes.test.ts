import { describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ exigir: vi.fn(), salvar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.exigir }));
vi.mock("@/lib/vendas/persistencia-formas-pagamento", () => ({ salvarFormaPagamentoVenda: sim.salvar }));
vi.mock("@/lib/vendas/persistencia", () => ({ mensagemErroCadastro: () => "Erro" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { salvarFormaPagamentoVendaAction } from "@/app/(protegido)/vendas/formas-pagamento/actions";

describe("permissões das formas de pagamento", () => {
  it.each([["", "adicionar"], ["existente", "editar"]] as const)("confere %s antes de gravar", async (id, acao) => {
    sim.exigir.mockReset().mockRejectedValueOnce(new Error("Sem acesso"));
    sim.salvar.mockReset();
    await expect(salvarFormaPagamentoVendaAction({ id } as Parameters<typeof salvarFormaPagamentoVendaAction>[0])).rejects.toThrow("Sem acesso");
    expect(sim.exigir).toHaveBeenCalledWith("vendas.formas-pagamento", acao);
    expect(sim.salvar).not.toHaveBeenCalled();
  });
});
