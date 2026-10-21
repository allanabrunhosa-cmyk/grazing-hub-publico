import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ exigir: vi.fn(), porcoes: vi.fn(), insumos: vi.fn(), categorias: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: mocks.exigir }));
vi.mock("@/lib/prisma", () => ({ prisma: { porcaoInsumo: { findMany: mocks.porcoes }, insumo: { findMany: mocks.insumos }, categoria: { findMany: mocks.categorias } } }));
vi.mock("@/app/(protegido)/porcoes/porcoes-table", () => ({ PorcoesTable: () => null }));
import PorcoesPage from "@/app/(protegido)/porcoes/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.exigir.mockResolvedValue({ admin: false, permissoes: { "suprimentos.porcoes": ["visualizar", "editar"] }, excecoes: {} });
  mocks.porcoes.mockResolvedValue([{ id: "p1", insumoId: "i1", nome: "Fatia", unidade: "G", versao: 4, quantidade: { toFixed: () => "999999999.999999999" } }]);
  mocks.insumos.mockResolvedValue([{ id: "i1", nome: "Brie", unidade: "G", ativo: true, categoriaId: "c1", categoria: { nome: "Queijos" } }]);
  mocks.categorias.mockResolvedValue([{ id: "c1", nome: "Queijos", ordemPorcoes: 0, versaoOrdemPorcoes: 2 }]);
});
it("autoriza antes de consultar e mantém quantidade exata no DTO do cliente", async () => {
  const pagina = await PorcoesPage();
  expect(mocks.exigir).toHaveBeenCalledWith("suprimentos.porcoes");
  expect(pagina.props.porcoes[0].quantidade).toBe("999999999.999999999");
  expect(pagina.props.insumos).toEqual([{ id: "i1", nome: "Brie", unidade: "G", ativo: true, categoriaId: "c1", categoriaNome: "Queijos" }]);
  expect(pagina.props.categorias).toEqual([{ id: "c1", nome: "Queijos", ordem: 0, versao: 2 }]);
  expect(pagina.props).toMatchObject({ podeCriar: false, podeEditar: true, podeExcluir: false });
  expect(mocks.porcoes).toHaveBeenCalledWith(expect.objectContaining({ where: { excluidoEm: null, insumo: { excluidoEm: null } }, select: { id: true, insumoId: true, nome: true, quantidade: true, unidade: true, versao: true, quantidadeMedida: true, unidadeMedida: true } }));
});
it("nega a página sem ler porções ou insumos", async () => {
  mocks.exigir.mockRejectedValue(new Error("Acesso negado"));
  await expect(PorcoesPage()).rejects.toThrow("Acesso negado");
  expect(mocks.porcoes).not.toHaveBeenCalled(); expect(mocks.insumos).not.toHaveBeenCalled();
  expect(mocks.categorias).not.toHaveBeenCalled();
});
