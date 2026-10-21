import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ listar: vi.fn(), contar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { clienteVenda: { findMany: sim.listar, count: sim.contar } } }));
import { ADAPTADORES_MCP } from "@/lib/mcp/negocio";

const clientes = [{ id: "raiz-ativa", nome: "Empresa Ativa", tipo: "PJ", versao: 1, ativo: true, unificadoEmId: null }, { id: "raiz-inativa", nome: "Pessoa Inativa", tipo: "PF", versao: 2, ativo: false, unificadoEmId: null }, { id: "alias-inativo", nome: "Alias", tipo: "PF", versao: 1, ativo: false, unificadoEmId: "raiz-ativa" }];
type Filtro = { unificadoEmId: null; ativo?: boolean; id?: string };
function filtrar(where: Filtro) { return clientes.filter(cliente => cliente.unificadoEmId === where.unificadoEmId && (where.ativo === undefined || cliente.ativo === where.ativo) && (where.id === undefined || cliente.id === where.id)); }
beforeEach(() => {
  vi.clearAllMocks();
  sim.listar.mockImplementation(async ({ where }: { where: Filtro }) => filtrar(where).map(({ unificadoEmId, ...cliente }) => { void unificadoEmId; return cliente; }));
  sim.contar.mockImplementation(async ({ where }: { where: Filtro }) => filtrar(where).length);
});

it.each([[undefined, ["raiz-ativa", "raiz-inativa"]], [true, ["raiz-ativa"]], [false, ["raiz-inativa"]]] as const)("consulta retorna só canônicos e respeita ativo=%s", async (ativo, ids) => {
  const resposta = await ADAPTADORES_MCP.clientes_consultar(ativo === undefined ? {} : { ativo }, {} as never) as { registros: { id: string }[]; total: number };
  expect(resposta.registros.map(cliente => cliente.id)).toEqual(ids);
  expect(resposta.total).toBe(ids.length);
  const where = { unificadoEmId: null, ...(ativo === undefined ? {} : { ativo }) };
  expect(sim.listar).toHaveBeenCalledWith(expect.objectContaining({ where }));
  expect(sim.contar).toHaveBeenCalledWith({ where });
});

it("consulta direta por ID de alias não expõe o registro antigo", async () => {
  const resposta = await ADAPTADORES_MCP.clientes_consultar({ id: "alias-inativo" }, {} as never) as { registros: unknown[]; total: number };
  expect(resposta).toMatchObject({ registros: [], total: 0 });
  expect(sim.listar).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "alias-inativo", unificadoEmId: null } }));
});
