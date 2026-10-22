vi.mock("@/app/(protegido)/financeiro/fiscal/simples-actions", () => import("../visual/fiscal-unificado-simples-acoes"));
vi.mock("@/app/(protegido)/vendas/fiscal/estrutura-actions", () => import("../visual/estrutura-fiscal-acoes"));
vi.mock("@/app/(protegido)/financeiro/fiscal/manutencao-actions", () => import("../visual/fiscal-unificado-acoes"));
import { beforeEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ guarda: vi.fn(), pode: vi.fn(), produtos: vi.fn(), clientes: vi.fn(), regime: vi.fn(), alias: vi.fn() }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regime-empresa", () => ({ obterRegimeFiscalEmpresaBrasilNfe: sim.regime }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda, podeAcessar: sim.pode }));
vi.mock("@/lib/vendas/consultas", () => ({ consultarProdutos: sim.produtos }));
vi.mock("@/lib/vendas/clientes-consulta", () => ({ consultarClientesVenda: sim.clientes, consultarDestinoClienteUnificado: sim.alias }));
vi.mock("@/app/(protegido)/vendas/produtos/produtos-client", () => ({ ProdutosVenda: () => null }));
vi.mock("@/app/(protegido)/vendas/clientes/clientes-client", () => ({ ClientesVenda: () => null }));
vi.mock("@/app/(protegido)/vendas/importacao/importacao-client", () => ({ ImportacaoCatalogo: () => null }));
import ProdutosPage from "@/app/(protegido)/vendas/produtos/page";
import ClientesPage from "@/app/(protegido)/vendas/clientes/page";
beforeEach(() => {
  vi.resetAllMocks(); sim.pode.mockResolvedValue(false);
  sim.regime.mockResolvedValue({ crt: 1 });
  sim.alias.mockResolvedValue(null);
  sim.produtos.mockResolvedValue({ produtos: [{ id: "alvo" }], insumos: [{ id: "i", custo: 10 }] });
  sim.clientes.mockResolvedValue({ clientes: [{ id: "alvo" }], formasPagamento: [], creditos: null, fusoHorario: "America/Sao_Paulo" });
});
describe("destinos das atividades em Vendas", () => {
  it("autoriza a página antes de consultar o alvo", async () => {
    sim.guarda.mockRejectedValue(new Error("Sem acesso"));
    await expect(ProdutosPage({ searchParams: Promise.resolve({ entidade: "alvo" }) })).rejects.toThrow("Sem acesso");
    await expect(ClientesPage({ searchParams: Promise.resolve({ entidade: "alvo" }) })).rejects.toThrow("Sem acesso");
    expect(sim.produtos).not.toHaveBeenCalled(); expect(sim.clientes).not.toHaveBeenCalled();
    expect(sim.regime).not.toHaveBeenCalled();
    expect(sim.alias).not.toHaveBeenCalled();
    expect(sim.guarda.mock.calls).toEqual([["vendas.produtos"], ["vendas.clientes"]]);
  });
  it("passa o alvo existente sem conceder edição, custo, pedidos ou crédito", async () => {
    const produtos = await ProdutosPage({ searchParams: Promise.resolve({ entidade: "alvo" }) });
    const produto = produtos.props.children[0];
    expect(produto.props).toMatchObject({ entidadeInicialId: "alvo", editar: false, adicionar: false });
    expect(produto.props.dados.insumos).toEqual([{ id: "i", custo: null }]);
    expect(sim.regime).not.toHaveBeenCalled();
    const clientes = await ClientesPage({ searchParams: Promise.resolve({ entidade: "alvo" }) });
    expect(clientes.props).toMatchObject({ entidadeInicialId: "alvo", editar: false, adicionar: false, verPedidos: false, creditos: null });
    expect(sim.clientes).toHaveBeenCalledWith({ verPedidos: false, verCredito: false });
    expect(sim.alias).not.toHaveBeenCalled();
  });
  it("abre o destino efetivo do alias e conserva cliente separado quando ele existe na lista", async () => {
    sim.alias.mockResolvedValue("alvo");
    const alias = await ClientesPage({ searchParams: Promise.resolve({ entidade: "alias-antigo" }) });
    expect(alias.props.entidadeInicialId).toBe("alvo"); expect(sim.alias).toHaveBeenCalledWith("alias-antigo");
    sim.alias.mockClear();
    const direto = await ClientesPage({ searchParams: Promise.resolve({ entidade: "alvo" }) });
    expect(direto.props.entidadeInicialId).toBe("alvo"); expect(sim.alias).not.toHaveBeenCalled();
  });
  it("projeta o CRT somente quando a página autoriza leitura fiscal", async () => {
    sim.pode.mockImplementation(async (recurso: string, acao: string) => recurso === "vendas.fiscal" && acao === "visualizar");
    const produtos = await ProdutosPage({ searchParams: Promise.resolve({ entidade: "alvo" }) });
    expect(produtos.props.children[0].props).toMatchObject({ crt: 1, podeVerFiscal: true, podeEditarFiscal: false, editar: false });
    expect(sim.regime).toHaveBeenCalledOnce();
    expect(sim.produtos).toHaveBeenCalledWith(true);
  });
  it.each([undefined, "ausente", "<alvo>", "x".repeat(161), ["alvo", "outro"]])("ignora alvo inválido/ausente %s sem alterar os filtros", async entidade => {
    const produtos = await ProdutosPage({ searchParams: Promise.resolve({ entidade, situacao: "inativos" }) });
    expect(produtos.props.children[0].props).toMatchObject({ entidadeInicialId: undefined, situacaoInicial: "inativos" });
    const clientes = await ClientesPage({ searchParams: Promise.resolve({ entidade, busca: "Nome fictício", pagina: "2", situacao: "todos" }) });
    expect(clientes.props).toMatchObject({ entidadeInicialId: undefined, busca: "Nome fictício", pagina: 2, situacao: "todos" });
  });
});
