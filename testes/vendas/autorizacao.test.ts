import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sim = vi.hoisted(() => ({ guarda: vi.fn(), gravar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/vendas/persistencia", () => ({ salvarCliente: sim.gravar, salvarCategoria: sim.gravar, salvarGrupo: sim.gravar, salvarProduto: sim.gravar, salvarFiscalProduto: sim.gravar, reordenarCategorias: sim.gravar, mensagemErroCadastro: () => "Erro" }));
import { salvarClienteVendaAction, salvarCategoriaVendaAction, salvarGrupoVendaAction, salvarProdutoVendaAction, salvarFiscalVendaAction, reordenarCategoriasVendaAction, alterarSituacaoProdutoVendaAction, criarCanalVendaAction, alterarPrecoProdutoVendaAction, alterarStatusCadastroVendaAction } from "@/app/(protegido)/vendas/actions";
describe("autorização de todas as mutações de Vendas", () => {
  it.each([
    ["status forma de pagamento", () => alterarStatusCadastroVendaAction("FORMA_PAGAMENTO", "f", 1, false), "vendas.formas-pagamento"],
    ["status grupo", () => alterarStatusCadastroVendaAction("GRUPO", "g", 1, false), "vendas.catalogo"],
    ["status categoria", () => alterarStatusCadastroVendaAction("CATEGORIA", "c", 1, false), "vendas.catalogo"],
    ["status cliente", () => alterarStatusCadastroVendaAction("CLIENTE", "c", 1, false), "vendas.clientes"],
    ["status fiscal", () => alterarStatusCadastroVendaAction("GRUPO_FISCAL", "g", 1, false), "vendas.fiscal"],
    ["canal", () => criarCanalVendaAction("Site"), "vendas.produtos"],
    ["preço único", () => alterarPrecoProdutoVendaAction("p", 1, "1"), "vendas.produtos"],
    ["situação produto", () => alterarSituacaoProdutoVendaAction("p",1,false), "vendas.produtos"],
    ["cliente", () => salvarClienteVendaAction({ id: "novo" } as Parameters<typeof salvarClienteVendaAction>[0]), "vendas.clientes"],
    ["categoria", () => salvarCategoriaVendaAction({ id: "nova" } as Parameters<typeof salvarCategoriaVendaAction>[0]), "vendas.catalogo"],
    ["grupo", () => salvarGrupoVendaAction({ id: "grupo" } as Parameters<typeof salvarGrupoVendaAction>[0]), "vendas.catalogo"],
    ["produto", () => salvarProdutoVendaAction({ id: "produto" } as Parameters<typeof salvarProdutoVendaAction>[0]), "vendas.produtos"],
    ["fiscal", () => salvarFiscalVendaAction("p", 1, {}, false), "vendas.fiscal"],
    ["ordenação", () => reordenarCategoriasVendaAction([]), "vendas.catalogo"],
  ] as const)("bloqueia %s antes do acesso ao banco", async (_, chamar, recurso) => {
    sim.guarda.mockRejectedValueOnce(new Error("Sem acesso"));
    await expect(chamar()).rejects.toThrow("Sem acesso");
    expect(sim.guarda).toHaveBeenCalledWith(recurso, "editar"); expect(sim.gravar).not.toHaveBeenCalled();
  });
  it("vincular complemento também exige editar catálogo", async () => {
    sim.guarda.mockResolvedValueOnce({userId:"u",nome:"Teste"}).mockRejectedValueOnce(new Error("Sem acesso ao catálogo"));
    await expect(salvarProdutoVendaAction({id:"",novoVinculoComplemento:{grupoId:"g",preco:"0"}} as Parameters<typeof salvarProdutoVendaAction>[0])).rejects.toThrow("Sem acesso ao catálogo");
    expect(sim.guarda).toHaveBeenLastCalledWith("vendas.catalogo","editar");expect(sim.gravar).not.toHaveBeenCalled();
  });
  it("editar fiscal junto ao produto exige permissão fiscal antes de gravar", async () => {
    sim.guarda.mockResolvedValueOnce({ userId: "u", nome: "Teste" }).mockRejectedValueOnce(new Error("Sem fiscal"));
    await expect(salvarProdutoVendaAction({ id: "p", salvarFiscal: true } as Parameters<typeof salvarProdutoVendaAction>[0])).rejects.toThrow("Sem fiscal");
    expect(sim.guarda).toHaveBeenLastCalledWith("vendas.fiscal", "editar");
    expect(sim.gravar).not.toHaveBeenCalled();
  });
});
