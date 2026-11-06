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
  it("bloqueia lançamento direto de uma NFS-e somente fiscal", async () => {
    banco.notaFiscalServico.findUnique.mockResolvedValue({ id: "nota", status: "ACEITA", destinoFinanceiro: "SOMENTE_FISCAL", lancamentos: [] });
    expect(await lancarNfse(input)).toMatchObject({ erro: expect.stringContaining("somente no fiscal") });
    expect(banco.notaFiscalServico.updateMany).not.toHaveBeenCalled();
    expect(banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });

  it("não lança se outra decisão ocorreu entre leitura e gravação", async () => {
    banco.notaFiscalServico.findUnique.mockResolvedValue({ id: "nota", status: "ACEITA", lancamentos: [], valorLiquido: 100 });
    banco.categoriaFinanceira.findUnique.mockResolvedValue({ id: "categoria", ativo: true });
    banco.notaFiscalServico.updateMany.mockResolvedValue({ count: 0 });
    expect(await lancarNfse(input)).toHaveProperty("erro");
    expect(banco.notaFiscalServico.updateMany).toHaveBeenCalledWith({
      where: { id: "nota", status: "ACEITA", lancamentos: { none: {} }, OR: [{ destinoFinanceiro: null }, { destinoFinanceiro: "FINANCEIRO" }] },
      data: { status: "LANCADA" },
    });
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

describe("vencimento opcional no aceite da NFS-e", () => {
  it("guarda o dia civil escolhido sem criar despesa", async () => {
    banco.notaFiscalServico.updateMany.mockResolvedValue({ count: 1 });
    expect(await decidirNfse({ nfseId: "nota", decisao: "ACEITAR", autorNome: "Teste", dataVencimento: "2028-02-29" })).toEqual({ ok: true });
    expect(banco.notaFiscalServico.updateMany).toHaveBeenCalledWith({
      where: { id: "nota", status: "PENDENTE", lancamentos: { none: {} } },
      data: { status: "ACEITA", dataVencimento: new Date("2028-02-29T00:00:00.000Z") },
    });
    expect(banco.eventoNfse.create).toHaveBeenCalledTimes(1);
    expect(banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
    expect(banco.notaFiscalServicoLancamento.create).not.toHaveBeenCalled();
  });

  it.each(["2026-02-30", "0206-10-20", "2201-01-01", "20/10/2026", "2026-10-20T12:00:00Z"])("recusa vencimento inválido %s antes da gravação", async dataVencimento => {
    expect(await decidirNfse({ nfseId: "nota", decisao: "ACEITAR", autorNome: "Teste", dataVencimento })).toHaveProperty("erro");
    expect(banco.notaFiscalServico.updateMany).not.toHaveBeenCalled();
    expect(banco.eventoNfse.create).not.toHaveBeenCalled();
  });

  it("não guarda vencimento em uma recusa", async () => {
    expect(await decidirNfse({ nfseId: "nota", decisao: "RECUSAR", autorNome: "Teste", dataVencimento: "2026-10-20" })).toHaveProperty("erro");
    expect(banco.notaFiscalServico.updateMany).not.toHaveBeenCalled();
  });

  it("não regrava a data nem duplica o evento ao repetir o aceite", async () => {
    banco.notaFiscalServico.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const entrada = { nfseId: "nota", decisao: "ACEITAR" as const, autorNome: "Teste", dataVencimento: "2026-10-20" };
    expect(await decidirNfse(entrada)).toEqual({ ok: true });
    expect(await decidirNfse({ ...entrada, dataVencimento: "2026-10-25" })).toHaveProperty("erro");
    expect(banco.eventoNfse.create).toHaveBeenCalledTimes(1);
    expect(banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });
});

describe("destino financeiro da NFS-e", () => {
  it.each([
    ["FINANCEIRO", "DESTINO_FINANCEIRO_NO_HUB"],
    ["SOMENTE_FISCAL", "DESTINO_SOMENTE_FISCAL_NO_HUB"],
  ] as const)("aceita com destino explícito %s, registra a escolha e não lança despesa", async (destinoFinanceiro, tipo) => {
    banco.notaFiscalServico.updateMany.mockResolvedValue({ count: 1 });
    expect(await decidirNfse({ nfseId: "nota", decisao: "ACEITAR", autorNome: "Operador teste", destinoFinanceiro })).toEqual({ ok: true });
    expect(banco.notaFiscalServico.updateMany).toHaveBeenCalledWith({
      where: { id: "nota", status: "PENDENTE", lancamentos: { none: {} } },
      data: { status: "ACEITA", destinoFinanceiro },
    });
    expect(banco.eventoNfse.create).toHaveBeenCalledTimes(2);
    expect(banco.eventoNfse.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ notaFiscalId: "nota", tipo: "ACEITE_NO_HUB", criadoPorNome: "Operador teste" }) });
    expect(banco.eventoNfse.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ notaFiscalId: "nota", tipo, criadoPorNome: "Operador teste" }) });
    expect(banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
    expect(banco.notaFiscalServicoLancamento.create).not.toHaveBeenCalled();
  });

  it("rejeita vencimento no aceite somente fiscal", async () => {
    expect(await decidirNfse({ nfseId: "nota", decisao: "ACEITAR", autorNome: "Teste", destinoFinanceiro: "SOMENTE_FISCAL", dataVencimento: "2026-11-20" })).toHaveProperty("erro");
    expect(banco.notaFiscalServico.updateMany).not.toHaveBeenCalled();
    expect(banco.eventoNfse.create).not.toHaveBeenCalled();
  });

  it("altera o destino legado sem tocar no vencimento, no status ou nos títulos", async () => {
    banco.notaFiscalServico.updateMany.mockResolvedValue({ count: 1 });
    expect(await decidirNfse({ nfseId: "nota", decisao: "ALTERAR_DESTINO_FINANCEIRO", autorNome: "Teste", destinoFinanceiro: "SOMENTE_FISCAL", destinoFinanceiroAnterior: null })).toEqual({ ok: true });
    expect(banco.notaFiscalServico.updateMany).toHaveBeenCalledWith({
      where: { id: "nota", status: "ACEITA", lancamentos: { none: {} }, destinoFinanceiro: null },
      data: { destinoFinanceiro: "SOMENTE_FISCAL" },
    });
    expect(banco.eventoNfse.create).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ notaFiscalId: "nota", tipo: "DESTINO_SOMENTE_FISCAL_NO_HUB", criadoPorNome: "Teste" }) });
    expect(banco.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });

  it("não repete o evento quando o formulário perdeu a reserva para outra alteração ou lançamento", async () => {
    banco.notaFiscalServico.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const entrada = { nfseId: "nota", decisao: "ALTERAR_DESTINO_FINANCEIRO" as const, autorNome: "Teste", destinoFinanceiro: "FINANCEIRO" as const, destinoFinanceiroAnterior: "SOMENTE_FISCAL" as const };
    expect(await decidirNfse(entrada)).toEqual({ ok: true });
    expect(await decidirNfse(entrada)).toMatchObject({ erro: expect.stringContaining("Atualize a página") });
    expect(banco.eventoNfse.create).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ tipo: "DESTINO_FINANCEIRO_NO_HUB" }) });
  });
});
