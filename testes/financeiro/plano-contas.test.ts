import { describe, expect, it, vi, beforeEach } from "vitest";
import { caminhoCategoria, categoriasComCaminho } from "@/lib/financeiro/caminho-categoria";
const sim = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn(), pai: vi.fn(), listar: vi.fn(), criar: vi.fn(), atualizar: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: sim.usuario }, categoriaFinanceira: { updateMany: sim.atualizar },
  $transaction: async (fn: (tx: unknown) => unknown) => fn({ categoriaFinanceira: { findUnique: sim.pai, findMany: sim.listar, create: sim.criar, updateMany: sim.atualizar } }) } }));
import { criarCategoriaFinanceiraAction, atualizarCategoriaFinanceiraAction, alternarAtivoCategoriaFinanceiraAction } from "@/app/(protegido)/financeiro/plano-de-contas/actions";

beforeEach(() => {
  vi.resetAllMocks();
  sim.sessao.mockResolvedValue({ userId: "usuario" });
  sim.usuario.mockResolvedValue({ ativo: true });
  sim.pai.mockResolvedValue({ id: "pai", grupo: "DESPESAS_OPERACIONAIS", ativo: true, pai: null });
  sim.listar.mockResolvedValue([
    { id: "raiz", paiId: null, grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
    { id: "filha", paiId: "raiz", grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
  ]);
  sim.atualizar.mockResolvedValue({ count: 1 });
});
function dados(paiId?: string) {
  const form = new FormData();
  form.set("nome", "Serviços terceiros"); form.set("grupo", "DESPESAS_OPERACIONAIS");
  if (paiId) form.set("paiId", paiId);
  return form;
}
describe("hierarquia do plano de contas", () => {
  it("ordena as opções por caminho sem alterar os registros originais", () => {
    const categorias = [{ nome: "ADS", pai: { nome: "Marketing", pai: { nome: "GA" } } }, { nome: "Aluguel", pai: { nome: "Consumo" } }];
    expect(categoriasComCaminho(categorias).map((categoria) => categoria.nome)).toEqual(["Consumo › Aluguel", "GA › Marketing › ADS"]);
    expect(categorias[0].nome).toBe("ADS");
  });
  it("distingue nomes iguais pelo caminho, inclusive com avô", () => {
    expect(caminhoCategoria({ nome: "Serviços terceiros", pai: { nome: "Marketing", pai: { nome: "GA (Gerais e ADM)" } } })).toBe("GA (Gerais e ADM) › Marketing › Serviços terceiros");
    expect(caminhoCategoria({ nome: "Salários" })).toBe("Salários");
  });
  it("cria categoria raiz preservando o comportamento anterior", async () => {
    expect(await criarCategoriaFinanceiraAction(null, dados())).toEqual({ ok: true });
    expect(sim.criar).toHaveBeenCalledWith({ data: { nome: "Serviços terceiros", grupo: "DESPESAS_OPERACIONAIS", paiId: null, centroCustoId: null } });
  });
  it("cria subdivisão dentro do mesmo grupo", async () => {
    sim.pai.mockResolvedValue({ grupo: "DESPESAS_OPERACIONAIS", ativo: true, pai: { paiId: null } });
    expect(await criarCategoriaFinanceiraAction(null, dados("marketing"))).toEqual({ ok: true });
    expect(sim.criar.mock.calls[0][0].data.paiId).toBe("marketing");
  });
  it.each([null, { grupo: "CMV", ativo: true, pai: null }, { grupo: "DESPESAS_OPERACIONAIS", ativo: false, pai: null }, { grupo: "DESPESAS_OPERACIONAIS", ativo: true, pai: { paiId: "avo" } }])("rejeita pai ausente, incompatível, inativo ou quarto nível", async (pai) => {
    sim.pai.mockResolvedValue(pai);
    expect(await criarCategoriaFinanceiraAction(null, dados("pai"))).toHaveProperty("erro");
    expect(sim.criar).not.toHaveBeenCalled();
  });
  it("valida grupo e duplicação entre irmãos", async () => {
    const form = dados(); form.set("grupo", "INVENTADO");
    expect(await criarCategoriaFinanceiraAction(null, form)).toHaveProperty("erro");
    expect(sim.criar).not.toHaveBeenCalled();
    sim.criar.mockRejectedValue({ code: "P2002" });
    expect(await criarCategoriaFinanceiraAction(null, dados())).toEqual({ erro: "Já existe uma categoria com esse nome neste nível do grupo." });
  });
  it("exige usuário ativo em todas as alterações", async () => {
    sim.sessao.mockResolvedValue(null);
    expect(await criarCategoriaFinanceiraAction(null, dados())).toHaveProperty("erro");
    expect(await atualizarCategoriaFinanceiraAction("id", { nome: "Outro", centroCustoId: null, grupo: "DESPESAS_OPERACIONAIS", paiId: null })).toHaveProperty("erro");
    expect(await alternarAtivoCategoriaFinanceiraAction("id", false)).toHaveProperty("erro");
    sim.sessao.mockResolvedValue({ userId: "inativo" }); sim.usuario.mockResolvedValue({ ativo: false });
    expect(await criarCategoriaFinanceiraAction(null, dados())).toHaveProperty("erro");
    expect(sim.criar).not.toHaveBeenCalled(); expect(sim.atualizar).not.toHaveBeenCalled();
  });
  it("edita os dados e mantém o vínculo escolhido com o pai", async () => {
    expect(await atualizarCategoriaFinanceiraAction("filha", { nome: " Novo nome ", centroCustoId: null, grupo: "DESPESAS_OPERACIONAIS", paiId: "raiz" })).toEqual({ ok: true });
    expect(sim.atualizar).toHaveBeenCalledWith({ where: { id: "filha", excluidoEm: null }, data: { nome: "Novo nome", centroCustoId: null, grupo: "DESPESAS_OPERACIONAIS", paiId: "raiz" } });
  });
  it("move o ramo completo para outro grupo da mesma natureza", async () => {
    sim.listar.mockResolvedValue([
      { id: "raiz", paiId: null, grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
      { id: "filha", paiId: "raiz", grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
      { id: "neta", paiId: "filha", grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
    ]);
    expect(await atualizarCategoriaFinanceiraAction("raiz", { nome: "GA", centroCustoId: null, grupo: "DESPESAS_FINANCEIRAS", paiId: null })).toEqual({ ok: true });
    expect(sim.atualizar).toHaveBeenNthCalledWith(1, { where: { id: { in: ["filha", "neta"] }, excluidoEm: null }, data: { grupo: "DESPESAS_FINANCEIRAS" } });
    expect(sim.atualizar).toHaveBeenNthCalledWith(2, { where: { id: "raiz", excluidoEm: null }, data: { nome: "GA", centroCustoId: null, grupo: "DESPESAS_FINANCEIRAS", paiId: null } });
  });
  it("impede ciclos, quarto nível e troca entre entrada e saída", async () => {
    sim.listar.mockResolvedValue([
      { id: "raiz", paiId: null, grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
      { id: "filha", paiId: "raiz", grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
      { id: "neta", paiId: "filha", grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
      { id: "outra", paiId: null, grupo: "DESPESAS_OPERACIONAIS", ativo: true, excluidoEm: null },
    ]);
    expect(await atualizarCategoriaFinanceiraAction("raiz", { nome: "Raiz", centroCustoId: null, grupo: "DESPESAS_OPERACIONAIS", paiId: "neta" })).toHaveProperty("erro");
    expect(await atualizarCategoriaFinanceiraAction("outra", { nome: "Outra", centroCustoId: null, grupo: "DESPESAS_OPERACIONAIS", paiId: "neta" })).toHaveProperty("erro");
    expect(await atualizarCategoriaFinanceiraAction("raiz", { nome: "Raiz", centroCustoId: null, grupo: "RECEITA_BRUTA", paiId: null })).toEqual({ erro: "Mova a categoria somente entre grupos da mesma natureza: entrada ou saída." });
    expect(sim.atualizar).not.toHaveBeenCalled();
  });
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
