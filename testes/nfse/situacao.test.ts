import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const banco = vi.hoisted(() => ({
  notaFiscalServico: { updateMany: vi.fn(), findUnique: vi.fn() },
  eventoNfse: { create: vi.fn() },
  categoriaFinanceira: { findUnique: vi.fn() },
  formaPagamento: { upsert: vi.fn() },
  cartaoCredito: { findUnique: vi.fn() },
  lancamentoFinanceiro: { create: vi.fn() },
  notaFiscalServicoLancamento: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: typeof banco) => unknown) => fn(banco) } }));
import { decidirNfse } from "@/lib/nfse/situacao";
import { lancarNfse } from "@/lib/nfse/servico";

beforeEach(() => { vi.resetAllMocks(); });
describe("aceite e recusa de NFS sem movimentação financeira", () => {
  it.each([["ACEITAR", "ACEITA"], ["RECUSAR", "RECUSADA"]] as const)("registra a decisão autorizada com autoria (%s)", async (decisao, status) => {
    banco.notaFiscalServico.updateMany.mockResolvedValue({ count: 1 });
    expect(await decidirNfse({ nfseId: "nota", decisao, autorNome: "Operador teste" })).toEqual({ ok: true });
    expect(banco.notaFiscalServico.updateMany).toHaveBeenCalledWith({
      where: { id: "nota", status: "PENDENTE", lancamentos: { none: {} } },
      data: { status },
    });
    expect(banco.eventoNfse.create).toHaveBeenCalledWith({ data: expect.objectContaining({ notaFiscalId: "nota", tipo: decisao === "ACEITAR" ? "ACEITE_NO_HUB" : "RECUSA_NO_HUB", criadoPorNome: "Operador teste" }) });
    expect(banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });
  it("recusa uma alteração concorrente sem gravar evento", async () => {
    banco.notaFiscalServico.updateMany.mockResolvedValue({ count: 0 });
    expect(await decidirNfse({ nfseId: "nota", decisao: "ACEITAR", autorNome: "Teste" })).toHaveProperty("erro");
    expect(banco.eventoNfse.create).not.toHaveBeenCalled();
  });
});
describe("proteção do lançamento financeiro", () => {
  const input = { nfseId: "nota", categoriaId: "categoria", descricao: "Teste", dataVencimento: "2026-09-20", autorId: "usuario", autorNome: "Teste" };
  it.each(["IGNORADA", "RECUSADA", "CANCELADA", "LANCADA"])("não lança uma nota %s", async status => {
    banco.notaFiscalServico.findUnique.mockResolvedValue({ id: "nota", status, lancamentos: [] });
    expect(await lancarNfse(input)).toHaveProperty("erro");
    expect(banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });
  it("não lança se outra decisão ocorreu entre leitura e gravação", async () => {
    banco.notaFiscalServico.findUnique.mockResolvedValue({ id: "nota", status: "ACEITA", lancamentos: [], valorLiquido: 100 });
    banco.categoriaFinanceira.findUnique.mockResolvedValue({ id: "categoria", ativo: true });
    banco.notaFiscalServico.updateMany.mockResolvedValue({ count: 0 });
    expect(await lancarNfse(input)).toHaveProperty("erro");
    expect(banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
    expect(banco.notaFiscalServicoLancamento.create).not.toHaveBeenCalled();
  });
  it("cria parcelas de cartão com rateio fechado e vínculo da nota", async () => {
    banco.notaFiscalServico.findUnique.mockResolvedValue({ id: "nota", status: "ACEITA", lancamentos: [], valorLiquido: 100, valorServico: 100, dataCompetencia: new Date("2026-09-01"), dataEmissao: new Date("2026-09-15"), fornecedorId: "fornecedor", prestadorNome: "Prestador" });
    banco.categoriaFinanceira.findUnique.mockResolvedValue({ id: "categoria", ativo: true, excluidoEm: null });
    banco.cartaoCredito.findUnique.mockResolvedValue({ diaFechamento: 10, diaVencimento: 20, ativo: true, contaBancaria: { ativo: true } });
    banco.notaFiscalServico.updateMany.mockResolvedValue({ count: 1 });
    banco.formaPagamento.upsert.mockResolvedValue({ id: "forma-cartao" });
    banco.lancamentoFinanceiro.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: `lancamento-${banco.lancamentoFinanceiro.create.mock.calls.length}`, ...data }));
    const resultado = await lancarNfse({
      nfseId: "nota", categoriaId: "categoria", descricao: "Serviço", dataVencimento: "2026-10-20", autorId: "usuario", autorNome: "Teste",
      parcelas: [
        { numero: "001", valor: 33.33, dataVencimento: "2026-10-20", formaPagamento: "CARTAO", cartaoCreditoId: "cartao", dataCompra: "2026-09-17", parcelaCartao: 1 },
        { numero: "002", valor: 33.33, dataVencimento: "2026-11-20", formaPagamento: "CARTAO", cartaoCreditoId: "cartao", dataCompra: "2026-09-17", parcelaCartao: 2 },
        { numero: "003", valor: 33.34, dataVencimento: "2026-12-20", formaPagamento: "CARTAO", cartaoCreditoId: "cartao", dataCompra: "2026-09-17", parcelaCartao: 3 },
      ],
    });
    expect(resultado).toEqual({ ok: true });
    expect(banco.lancamentoFinanceiro.create).toHaveBeenCalledTimes(3);
    expect((banco.lancamentoFinanceiro.create.mock.calls as Array<[{ data: { valor: number } }]>).map(call => call[0].data.valor).reduce((s, valor) => s + valor, 0)).toBe(100);
    expect(banco.notaFiscalServicoLancamento.create).toHaveBeenCalledTimes(3);
    expect(banco.notaFiscalServico.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "LANCADA" } }));
  });
});
