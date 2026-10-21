import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ exigir: vi.fn(), consultar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: m.exigir }));
vi.mock("@/lib/estoque/extrato-individual", () => ({ consultarExtratoIndividual: m.consultar }));
import { consultarMovimentacoesItemAction } from "@/app/(protegido)/insumos/movimentacoes-actions";
const filtros = { insumoId: "produto", de: "", ate: "", tipo: "", ordem: "desc" as const, pagina: 1 };
beforeEach(() => { vi.resetAllMocks(); });
it("não concede estoque pela permissão isolada de insumos", async () => {
  m.exigir.mockImplementation(async recurso => { if (recurso === "inventario") throw new Error("Acesso negado."); });
  await expect(consultarMovimentacoesItemAction(filtros)).rejects.toThrow("Acesso negado");
  expect(m.consultar).not.toHaveBeenCalled();
});
it("consulta somente após as duas guardas existentes", async () => {
  m.consultar.mockResolvedValue({ linhas: [], total: 0, pagina: 1, paginas: 1 });
  expect(await consultarMovimentacoesItemAction(filtros)).toHaveProperty("dados.total", 0);
  expect(m.exigir.mock.calls).toEqual([["insumos"], ["inventario"]]);
  expect(m.consultar).toHaveBeenCalledExactlyOnceWith(filtros);
});
