import { beforeEach, describe, it, expect, vi } from "vitest";
const sim = vi.hoisted(() => ({ exigir: vi.fn(), preparar: vi.fn(), aplicar: vi.fn(), revalidar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.exigir }));
vi.mock("@/lib/vendas/importacao", () => ({ previaImportacao: sim.preparar, aplicarImportacao: sim.aplicar }));
vi.mock("@/lib/vendas/persistencia", () => ({ mensagemErroCadastro: () => "Erro de teste" }));
vi.mock("next/cache", () => ({ revalidatePath: sim.revalidar }));
import { prepararImportacaoVendaAction, aplicarImportacaoVendaAction } from "@/app/(protegido)/vendas/importacao/actions";
beforeEach(() => vi.resetAllMocks());
describe("permissões compostas de importação", () => {
  it.each([0, 1, 2])("prévia bloqueia sem a permissão de índice %i", async indice => {
    let chamada = 0;
    sim.exigir.mockImplementation(async () => { if (chamada++ === indice) throw Error("Sem acesso"); return { userId: "teste" }; });
    await expect(prepararImportacaoVendaAction("{}")).rejects.toThrow("Sem acesso");
    expect(sim.preparar).not.toHaveBeenCalled();
  });
  it.each([0, 1, 2, 3, 4])("aplicação bloqueia sem a permissão de índice %i", async indice => {
    let chamada = 0;
    sim.exigir.mockImplementation(async () => { if (chamada++ === indice) throw Error("Sem acesso"); return { userId: "teste" }; });
    await expect(aplicarImportacaoVendaAction("{}", "token")).rejects.toThrow("Sem acesso");
    expect(sim.aplicar).not.toHaveBeenCalled();
    expect(sim.revalidar).not.toHaveBeenCalled();
  });
});
