import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
vi.mock("server-only", () => ({}));
const sim = vi.hoisted(() => ({ guarda: vi.fn(), pedidos: vi.fn(), fornecedores: vi.fn(), insumos: vi.fn(), vazio: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda, podeAcessar: vi.fn(async () => false) }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  pedidoCompra: { findMany: sim.pedidos }, fornecedor: { findMany: sim.fornecedores }, insumo: { findMany: sim.insumos },
  cotacao: { findMany: sim.vazio }, canalPedido: { findMany: sim.vazio }, formaPagamento: { findMany: sim.vazio },
  categoria: { findMany: sim.vazio }, centroCusto: { findMany: sim.vazio }, categoriaFinanceira: { findMany: sim.vazio },
} }));
vi.mock("@/lib/insumos/custo-preparacao", () => ({ calcularCustosPreparacoes: () => new Map() }));
vi.mock("@/app/(protegido)/compras/pedidos-view", () => ({ PedidosView: () => null }));
vi.mock("@/app/(protegido)/fornecedores/fornecedores-table", () => ({ FornecedoresTable: () => null }));
vi.mock("@/app/(protegido)/fornecedores/fornecedor-dialog", () => ({ FornecedorDialog: () => null }));
vi.mock("@/app/(protegido)/fornecedores/import-fornecedores-dialog", () => ({ ImportFornecedoresDialog: () => null }));
vi.mock("@/app/(protegido)/fornecedores/export-fornecedores-button", () => ({ ExportFornecedoresButton: () => null }));
vi.mock("@/app/(protegido)/insumos/insumos-table", () => ({ InsumosTable: () => null }));
vi.mock("@/app/(protegido)/insumos/insumo-dialog", () => ({ InsumoDialog: () => null }));
vi.mock("@/app/(protegido)/insumos/categorias-dialog", () => ({ CategoriasDialog: () => null }));
vi.mock("@/app/(protegido)/insumos/import-insumos-dialog", () => ({ ImportInsumosDialog: () => null }));
vi.mock("@/app/(protegido)/insumos/export-insumos-button", () => ({ ExportInsumosButton: () => null }));
import ComprasPage from "@/app/(protegido)/compras/page";
import FornecedoresPage from "@/app/(protegido)/fornecedores/page";
import InsumosPage from "@/app/(protegido)/insumos/page";
import { fornecedorStatus, insumoStatus } from "../cadastros/dados";

function consumidor(no: ReactNode): Record<string, unknown> | undefined {
  if (Array.isArray(no)) return no.map(consumidor).find(Boolean);
  if (!isValidElement<Record<string, unknown>>(no)) return;
  if (Object.hasOwn(no.props, "entidadeInicialId")) return no.props;
  return consumidor(no.props.children as ReactNode);
}
beforeEach(() => {
  vi.resetAllMocks();
  sim.guarda.mockResolvedValue({ userId: "leitor-sintetico", nome: "Leitor fictício", admin: false, permissoes: {}, excecoes: {} });
  sim.vazio.mockResolvedValue([]);
  sim.fornecedores.mockResolvedValue([{ ...fornecedorStatus, insumosPrincipais: [], insumosHomologados: [] }]);
  sim.insumos.mockResolvedValue([{ ...insumoStatus, modoPreparo: [], categoriaFinanceira: null }]);
  sim.pedidos.mockResolvedValue([{ id: "compra-ficticia", numero: 1, fornecedorId: null, fornecedorAvulso: "Fornecedor fictício", fornecedor: null,
    dataPedido: new Date("2026-10-01T12:00:00Z"), previsaoEntrega: null, status: "CONFIRMADO", usoConsumo: true, observacoes: null,
    itens: [], recebimentos: [], historico: [], excluidoEm: null }]);
});

describe.each([
  { modulo: "compras", pagina: ComprasPage, id: "compra-ficticia" },
  { modulo: "fornecedores", pagina: FornecedoresPage, id: fornecedorStatus.id },
  { modulo: "insumos", pagina: InsumosPage, id: insumoStatus.id },
])("referência de leitura da página $modulo", ({ modulo, pagina, id }) => {
  it("aguarda query, exige visualizar e usa só entidade presente no DTO autorizado", async () => {
    const props = consumidor(await pagina({ searchParams: Promise.resolve({ entidade: id }) }));
    expect(props?.entidadeInicialId).toBe(id);
    expect(sim.guarda).toHaveBeenCalledExactlyOnceWith(modulo);
  });
  it.each(["id inexistente", "ausente", "a".repeat(161), ["primeiro", "segundo"]])("ignora parâmetro inválido ou alvo ausente: %j", async entidade => {
    const props = consumidor(await pagina({ searchParams: Promise.resolve({ entidade }) }));
    expect(props?.entidadeInicialId).toBeUndefined();
  });
  it("conserva inicialização padrão sem parâmetro", async () => {
    expect(consumidor(await pagina({}))?.entidadeInicialId).toBeUndefined();
  });
  it("não consulta cadastro nem repassa alvo se autorização for negada", async () => {
    sim.guarda.mockRejectedValue(new Error("Acesso negado"));
    await expect(pagina({ searchParams: Promise.resolve({ entidade: id }) })).rejects.toThrow("Acesso negado");
    expect(sim.pedidos).not.toHaveBeenCalled(); expect(sim.insumos).not.toHaveBeenCalled(); expect(sim.fornecedores).not.toHaveBeenCalled();
  });
});
