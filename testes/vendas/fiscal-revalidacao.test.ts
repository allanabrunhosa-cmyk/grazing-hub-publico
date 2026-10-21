import { beforeEach, expect, it, vi } from "vitest";
import {
  alterarSituacaoProdutoVendaAction,
  alterarStatusCadastroVendaAction,
  excluirCadastroVendaAction,
  salvarCategoriaVendaAction,
  salvarFiscalVendaAction,
  salvarGrupoFiscalVendaAction,
  salvarProdutoVendaAction,
} from "@/app/(protegido)/vendas/actions";

const sim = vi.hoisted(() => ({ guarda: vi.fn(), salvar: vi.fn(), atualizar: vi.fn(), categoria: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: sim.atualizar }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda }));
vi.mock("@/lib/prisma", () => ({ prisma: { categoriaVenda: { findUniqueOrThrow: sim.categoria } } }));
vi.mock("@/lib/vendas/persistencia", () => ({
  alterarSituacaoProduto: sim.salvar, alterarStatusCadastroVenda: sim.salvar, excluirCadastroVenda: sim.salvar,
  salvarCategoria: sim.salvar, salvarFiscalProduto: sim.salvar, salvarGrupoFiscal: sim.salvar,
  salvarProduto: sim.salvar, mensagemErroCadastro: () => "Falha sintética",
}));
beforeEach(() => {
  vi.resetAllMocks();
  sim.guarda.mockResolvedValue({ userId: "usuario-ficticio", nome: "Teste" });
  sim.salvar.mockResolvedValue("registro-ficticio");
  sim.categoria.mockResolvedValue({ id: "categoria-ficticia", produtos: [] });
});

const operacoes = [
  ["salvar vínculo fiscal", () => salvarFiscalVendaAction("produto-ficticio", 1, {}, false, "grupo-ficticio"), "vendas.fiscal", "editar"],
  ["salvar grupo fiscal", () => salvarGrupoFiscalVendaAction({ id: "grupo-ficticio", versao: 1, nome: "Grupo sintético", fiscal: {}, ativo: true }), "vendas.fiscal", "editar"],
  ["salvar produto", () => salvarProdutoVendaAction({ id: "produto-ficticio" } as Parameters<typeof salvarProdutoVendaAction>[0]), "vendas.produtos", "editar"],
  ["salvar categoria de produtos", () => salvarCategoriaVendaAction({ id: "categoria-ficticia" } as Parameters<typeof salvarCategoriaVendaAction>[0]), "vendas.catalogo", "editar"],
  ["alterar situação do produto", () => alterarSituacaoProdutoVendaAction("produto-ficticio", 1, false), "vendas.produtos", "editar"],
  ["alterar status do grupo fiscal", () => alterarStatusCadastroVendaAction("GRUPO_FISCAL", "grupo-ficticio", 1, false), "vendas.fiscal", "editar"],
  ["excluir grupo fiscal", () => excluirCadastroVendaAction("GRUPO_FISCAL", "grupo-ficticio", 1), "vendas.fiscal", "excluir"],
] as const;

it.each(operacoes)("%s atualiza cadastros na rota nova e preserva a rota comercial", async (_, executar, recurso, acao) => {
  const resultado = await executar();
  expect(resultado).toHaveProperty("ok", true);
  expect(sim.guarda).toHaveBeenCalledWith(recurso, acao);
  expect(sim.atualizar).toHaveBeenCalledWith("/vendas", "layout");
  expect(sim.atualizar).toHaveBeenCalledWith("/financeiro/fiscal/grupos");
  expect(sim.atualizar).toHaveBeenCalledWith("/financeiro/fiscal/vinculos");
});

it.each(operacoes)("%s continua bloqueada antes de gravar ou invalidar páginas sem autorização", async (_, executar) => {
  sim.guarda.mockRejectedValueOnce(new Error("SEM_ACESSO"));
  await expect(executar()).rejects.toThrow("SEM_ACESSO");
  expect(sim.salvar).not.toHaveBeenCalled();
  expect(sim.atualizar).not.toHaveBeenCalled();
});

it("falha de persistência mantém os dados e não invalida os cadastros", async () => {
  sim.salvar.mockRejectedValueOnce(new Error("Falha sintética"));
  expect(await salvarFiscalVendaAction("produto-ficticio", 1, {}, false)).toEqual({ erro: "Falha sintética" });
  expect(sim.atualizar).not.toHaveBeenCalled();
});
