import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ insumos: vi.fn(), saldos: vi.fn(), historico: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: async () => ({ admin: true }) }));
vi.mock("@/lib/estoque/consultar-perdas", () => ({ obterUsuarioInventario: async () => ({ nome: "Operador fictício" }) }));
vi.mock("@/lib/estoque/posicao", () => ({ calcularPosicaoHistorica: m.historico, chavePosicao: (i: string, l: string) => `${i}:${l}`, fimDoDia: (d: string) => new Date(`${d}T23:59:59Z`) }));
vi.mock("@/lib/prisma", () => ({ prisma: { insumo: { findMany: m.insumos }, saldoEstoque: { findMany: m.saldos }, localEstoque: { findMany: async () => [{ id: "local", nome: "Local fictício" }] }, categoriaPerda: { findMany: async () => [] } } }));
vi.mock("@/app/(protegido)/inventario/posicao-atual-table", () => ({ PosicaoAtualTable: () => null }));
import InventarioPage from "@/app/(protegido)/inventario/page";
beforeEach(() => { vi.clearAllMocks(); m.saldos.mockResolvedValue([]); m.insumos.mockResolvedValue([{ id: "insumo", nome: "Insumo fictício excluído", tipo: "INSUMO", unidade: "KG", estoqueMinimo: 0, estoqueMaximo: null, custoMedio: 1, fornecedoresHomologados: [] }]); m.historico.mockResolvedValue(new Map([["insumo:local", 8]])); });
it("mantém insumos excluídos e suas quantidades na consulta histórica", async () => {
  const pagina = await InventarioPage({ searchParams: Promise.resolve({ data: "2026-09-01" }) });
  expect(m.insumos).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ ativo: true }, { excluidoEm: { not: null } }] } }));
  expect(pagina.props.linhas[0]).toMatchObject({ nome: "Insumo fictício excluído", saldosPorLocal: { local: 8 } });
  expect(m.saldos).not.toHaveBeenCalled();
});
it("conserva somente ativos na posição atual", async () => {
  await InventarioPage({ searchParams: Promise.resolve({}) });
  expect(m.insumos).toHaveBeenCalledWith(expect.objectContaining({ where: { ativo: true } }));
  expect(m.historico).not.toHaveBeenCalled();
});
