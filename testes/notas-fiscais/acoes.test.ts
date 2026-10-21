vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";

const simulacao = vi.hoisted(() => {
  const banco = {
    $queryRaw: vi.fn(),
    cancelamentoCompra: { findUnique: vi.fn() },
    notaFiscalRecebida: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn() },
    notaFiscalDuplicata: { findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    formaPagamento: { upsert: vi.fn() }, insumo: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn() },
    categoriaFinanceira: { findFirst: vi.fn(), findUnique: vi.fn() }, fornecedor: { findUnique: vi.fn() },
    notaFiscalItem: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    lancamentoFinanceiro: { create: vi.fn() }, notaFiscalItemLancamento: { create: vi.fn() },
    fornecedorNotaVinculo: { findUnique: vi.fn() },
    insumoCodigoFornecedor: { upsert: vi.fn() }, insumoFornecedor: { upsert: vi.fn() },
  };
  return { banco, transacao: vi.fn(), sessao: vi.fn(), manifestar: vi.fn(), sincronizar: vi.fn(), movimentar: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: { ...simulacao.banco, $transaction: simulacao.transacao } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: simulacao.sessao }));
vi.mock("@/lib/sefaz/manifestar", () => ({ manifestarNotaFiscal: simulacao.manifestar }));
vi.mock("@/lib/sefaz/busca-agendada", () => ({ agendarBusca: simulacao.sincronizar }));
vi.mock("@/lib/estoque/registrarMovimentacao", () => ({ registrarMovimentacao: simulacao.movimentar }));

import { confirmarConciliacaoNotaAction, manifestarAction, sincronizarAction } from "@/app/(protegido)/notas-fiscais/actions";
import { revalidatePath } from "next/cache";

const duplicatas = [
  { id: "parcela-1", numero: "001", dataVencimento: "2026-10-10", valor: 1 },
  { id: "parcela-2", numero: "002", dataVencimento: "2026-11-10", valor: 2 },
];

beforeEach(() => {
  vi.resetAllMocks();
  simulacao.sessao.mockResolvedValue({ userId: "usuario-teste" });
  simulacao.banco.formaPagamento.upsert.mockResolvedValue({ id: "boleto" });
  simulacao.banco.insumo.findUniqueOrThrow.mockResolvedValue({ unidade: "KG" });
  simulacao.transacao.mockImplementation(async (executar) => executar(simulacao.banco));
  simulacao.banco.notaFiscalRecebida.findUniqueOrThrow.mockResolvedValue({ id: "nota", chaveAcesso: "0".repeat(44), fornecedorCnpj: null, dataEmissao: new Date("2026-09-10"), ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" });
  simulacao.banco.cancelamentoCompra.findUnique.mockResolvedValue(null);
  simulacao.banco.notaFiscalItem.count.mockResolvedValue(0);
  simulacao.banco.notaFiscalDuplicata.findMany.mockResolvedValue(duplicatas.map((parcela) => ({ ...parcela, dataVencimento: new Date(`${parcela.dataVencimento}T12:00:00`), _count: { lancamentos: 0 } })));
  simulacao.banco.categoriaFinanceira.findFirst.mockResolvedValue({ id: "cmv" });
  simulacao.banco.insumo.findUnique.mockResolvedValue({ nome: "Queijo", categoriaFinanceiraId: null });
  simulacao.banco.categoriaFinanceira.findUnique.mockResolvedValue({ ativo: true, excluidoEm: null, grupo: "DESPESAS_OPERACIONAIS" });
  simulacao.banco.notaFiscalItem.findUnique.mockResolvedValue({ id: "item", notaFiscalId: "nota", status: "PENDENTE", numeroItem: 1, descricaoProduto: "Queijo" });
  simulacao.banco.lancamentoFinanceiro.create.mockResolvedValue({ id: "lancamento" });
  simulacao.movimentar.mockResolvedValue({ movimentacaoId: "movimento" });
});

describe("ações e conciliação com banco simulado", () => {
  it("exige sessão para manifestação e sincronização", async () => {
    simulacao.sessao.mockResolvedValue(null);
    expect(await manifestarAction("0".repeat(44), "CONFIRMACAO_DA_OPERACAO")).toMatchObject({ sucesso: false });
    expect(await sincronizarAction()).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
    expect(simulacao.sincronizar).not.toHaveBeenCalled();
  });
  it("preserva o retorno excepcional de manifestarAction", async () => {
    simulacao.banco.notaFiscalRecebida.findUnique.mockResolvedValue({ id: "nota" });
    simulacao.banco.$queryRaw.mockResolvedValue([{ obtida: true }]);
    simulacao.manifestar.mockResolvedValue({ sucesso: false, mensagem: "Falha simulada", protocolo: null });
    expect(await manifestarAction("0".repeat(44), "DESCONHECIMENTO_DA_OPERACAO")).toEqual({ sucesso: false, mensagem: "Falha simulada", protocolo: null });
  });
  it("não manifesta enquanto Ciência ou aceite detém a trava da nota", async () => {
    simulacao.banco.notaFiscalRecebida.findUnique.mockResolvedValue({ id: "nota" });
    simulacao.banco.$queryRaw.mockResolvedValue([{ obtida: false }]);
    expect(await manifestarAction("0".repeat(44), "DESCONHECIMENTO_DA_OPERACAO")).toMatchObject({ sucesso: false });
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it.each(["ESTOQUE", "USO_E_CONSUMO"] as const)("concilia %s e rateia o valor sem perder centavos", async (destino) => {
    const item = destino === "ESTOQUE"
      ? { notaFiscalItemId: "item", acao: "CONCILIAR" as const, destino, insumoId: "insumo", quantidade: 2, valorTotal: 100.01, modoCusto: "NOVO" as const }
      : { notaFiscalItemId: "item", acao: "CONCILIAR" as const, destino, categoriaFinanceiraId: "consumo", valorTotal: 100.01 };
    const resultado = await confirmarConciliacaoNotaAction({ dataEntradaEstoque: "2024-02-29", notaFiscalId: "nota", localId: destino === "ESTOQUE" ? "local" : "", itens: [item], duplicatas });
    expect(resultado).toEqual({ ok: true, movimentacoesCriadas: destino === "ESTOQUE" ? 1 : 0 });
    const lancamentos = simulacao.banco.lancamentoFinanceiro.create.mock.calls.map(([entrada]) => entrada.data);
    expect(lancamentos.map((lancamento) => lancamento.valor)).toEqual([33.34, 66.67]);
    expect(lancamentos.map((lancamento) => lancamento.dataVencimento.toISOString().slice(0, 10))).toEqual(["2026-10-10", "2026-11-10"]);
    if (destino === "ESTOQUE") expect(simulacao.movimentar).toHaveBeenCalledWith(expect.objectContaining({ modoCusto: "NOVO", quantidade: 2, custoUnitario: 50.005 }));
    else expect(simulacao.movimentar).not.toHaveBeenCalled();
  });
  it("não duplica estoque nem despesas ao reenviar item já conciliado", async () => {
    simulacao.banco.notaFiscalItem.findUnique.mockResolvedValue({ id: "item", notaFiscalId: "nota", status: "CONCILIADO" });
    await confirmarConciliacaoNotaAction({ dataEntradaEstoque: "2024-02-29", notaFiscalId: "nota", localId: "local", duplicatas, itens: [{ notaFiscalItemId: "item", acao: "CONCILIAR", destino: "ESTOQUE", insumoId: "insumo", quantidade: 1, valorTotal: 100, modoCusto: "MEDIA" }] });
    expect(simulacao.movimentar).not.toHaveBeenCalled();
    expect(simulacao.banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });
  it("exige parcela para conciliar", async () => {
    expect(await confirmarConciliacaoNotaAction({ dataEntradaEstoque: "2024-02-29", notaFiscalId: "nota", localId: "", duplicatas: [], itens: [{ notaFiscalItemId: "item", acao: "CONCILIAR", destino: "USO_E_CONSUMO", categoriaFinanceiraId: "consumo", valorTotal: 100 }] })).toHaveProperty("erro");
    expect(simulacao.transacao).not.toHaveBeenCalled();
  });
  it("bloqueia remoção de parcela com lançamento existente", async () => {
    simulacao.banco.notaFiscalDuplicata.findMany.mockResolvedValue([{ id: "parcela-em-uso", numero: "001", _count: { lancamentos: 1 } }]);
    expect(await confirmarConciliacaoNotaAction({ dataEntradaEstoque: "2024-02-29", notaFiscalId: "nota", localId: "", duplicatas: [], itens: [{ notaFiscalItemId: "item", acao: "IGNORAR" }] })).toHaveProperty("erro");
    expect(simulacao.banco.notaFiscalDuplicata.delete).not.toHaveBeenCalled();
  });
});

 it.each(["ESTOQUE", "USO_E_CONSUMO"] as const)("usa o fornecedor memorizado nos lançamentos de %s", async destino => {
  simulacao.banco.notaFiscalRecebida.findUniqueOrThrow.mockResolvedValue({ id: "nota", chaveAcesso: "0".repeat(44), fornecedorCnpj: "12345678000199", dataEmissao: new Date("2026-09-10"), ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" });
  simulacao.banco.fornecedorNotaVinculo.findUnique.mockResolvedValue({ fornecedor: { id: "fornecedor-vinculado", nome: "Fornecedor conciliado", ativo: true, tipoCadastro: "FORNECEDOR" } });
  const item = destino === "ESTOQUE" ? { notaFiscalItemId: "item", acao: "CONCILIAR" as const, destino, insumoId: "insumo", quantidade: 2, valorTotal: 100, modoCusto: "MEDIA" as const } : { notaFiscalItemId: "item", acao: "CONCILIAR" as const, destino, categoriaFinanceiraId: "consumo", valorTotal: 100 };
  expect(await confirmarConciliacaoNotaAction({ dataEntradaEstoque: "2024-02-29", notaFiscalId: "nota", localId: "local", itens: [item], duplicatas })).toHaveProperty("ok");
  expect(simulacao.banco.lancamentoFinanceiro.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fornecedorId: "fornecedor-vinculado" }) }));
  if (destino === "ESTOQUE") {
    expect(simulacao.banco.insumoFornecedor.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ fornecedorId: "fornecedor-vinculado" }) }));
    expect(revalidatePath).toHaveBeenCalledWith("/fornecedores");
    expect(revalidatePath).toHaveBeenCalledWith("/compras");
  }
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
