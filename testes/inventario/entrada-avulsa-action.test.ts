import { beforeEach, describe, expect, it, vi } from "vitest";

const simulados = vi.hoisted(() => ({
  transacao: vi.fn(),
  movimento: vi.fn(),
  baixar: vi.fn(),
  compraCriar: vi.fn(),
  lancamentoCriar: vi.fn(),
}));

vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => ({ userId: "usuario" })) }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: simulados.transacao } }));
vi.mock("@/lib/estoque/registrarMovimentacao", () => ({ registrarMovimentacao: simulados.movimento }));
vi.mock("@/lib/financeiro/baixarLancamento", () => ({ baixarLancamento: simulados.baixar }));
vi.mock("@/lib/estoque/entrada-avulsa-servidor", () => ({
  prepararRegistroEntrada: vi.fn(async () => ({ autor: { id: "usuario", nome: "Usuário" }, hash: "hash", existente: null })),
  gravarRegistroEntrada: vi.fn(async () => ({ id: "registro" })),
}));

import { registrarEntradaAvulsaAction, type EntradaAvulsaInput } from "@/app/(protegido)/inventario/entrada-avulsa/actions";

const tx = {
  insumo: { findMany: vi.fn(async () => [{ id: "queijo" }, { id: "presunto" }]) },
  localEstoque: { findMany: vi.fn(async () => [{ id: "cozinha" }]) },
  fornecedor: { findFirst: vi.fn(async () => ({ id: "fornecedor", nome: "FORNECEDOR TESTE" })) },
  categoriaFinanceira: { findFirst: vi.fn(async () => ({ id: "cmv" })) },
  contaBancaria: { findFirst: vi.fn(async () => null) },
  formaPagamento: { upsert: vi.fn(async () => ({ id: "forma-boleto" })) },
  cartaoCredito: { findUnique: vi.fn(async () => ({ id: "cartao", ativo: true, diaFechamento: 10, diaVencimento: 20, contaBancariaId: "conta-cartao", contaBancaria: { ativo: true } })) },
  entradaAvulsaCompra: { create: simulados.compraCriar },
  lancamentoFinanceiro: { create: simulados.lancamentoCriar },
};

const entrada: EntradaAvulsaInput = {
  chave: "teste-chave-entrada-001",
  tipo: "COMPRA_SIMPLES",
  itens: [
    { insumoId: "queijo", localId: "cozinha", quantidade: 10, valorProdutos: 100 },
    { insumoId: "presunto", localId: "cozinha", quantidade: 30, valorProdutos: 300 },
  ],
  fornecedorId: "fornecedor",
  frete: 40,
  desconto: 20,
  custosAdicionais: [{ descricao: "Descarga", valor: 25 }],
  data: "2026-09-11",
  dataVencimento: "2026-09-20",
  pago: false,
  dataPagamento: null,
  contaBancariaId: null,
  observacao: "Compra no balcão",
};

beforeEach(() => {
  vi.clearAllMocks();
  simulados.compraCriar.mockResolvedValue({ id: "compra" });
  simulados.lancamentoCriar.mockResolvedValue({ id: "lancamento" });
  simulados.movimento
    .mockResolvedValueOnce({ movimentacaoId: "movimento-1" })
    .mockResolvedValueOnce({ movimentacaoId: "movimento-2" });
  simulados.transacao.mockImplementation(async executar => executar(tx));
});

describe("registro da compra sem nota", () => {
  it("cria o cabeçalho auditável, rateia os itens e gera uma única despesa do fornecedor", async () => {
    expect(await registrarEntradaAvulsaAction(entrada)).toEqual({
      ok: true,
      movimentacaoId: "movimento-1",
      entradaAvulsaCompraId: "compra",
      registroId: "registro",
    });
    expect(simulados.compraCriar).toHaveBeenCalledWith({ data: expect.objectContaining({
      fornecedorId: "fornecedor",
      valorProdutos: 400,
      frete: 40,
      desconto: 20,
      valorOutrosCustos: 25,
      valorTotal: 445,
      outrosCustos: [{ descricao: "Descarga", valor: 25 }],
    }) });
    expect(simulados.movimento).toHaveBeenCalledTimes(2);
    expect(simulados.movimento.mock.calls.map(chamada => chamada[0].valorTotal)).toEqual([111.25, 333.75]);
    expect(simulados.lancamentoCriar).toHaveBeenCalledTimes(1);
    expect(simulados.lancamentoCriar).toHaveBeenCalledWith({ data: expect.objectContaining({
      descricao: "COMPRA SEM NOTA — FORNECEDOR TESTE",
      valor: 445,
      fornecedorId: "fornecedor",
      origemEntradaAvulsaCompraId: "compra",
    }) });
  });

  it("exige fornecedor na compra antes de abrir uma transação", async () => {
    expect(await registrarEntradaAvulsaAction({ ...entrada, fornecedorId: null })).toEqual({ erro: "Selecione o fornecedor da compra." });
    expect(simulados.transacao).not.toHaveBeenCalled();
  });

  it("calcula o vencimento e vincula cartão à despesa", async () => {
    const resultado = await registrarEntradaAvulsaAction({
      ...entrada,
      itens: [
        { insumoId: "queijo", localId: "cozinha", quantidade: 2, fatorConversao: 10, valorProdutos: 100 },
        { insumoId: "presunto", localId: "cozinha", quantidade: 1, fatorConversao: 1, valorProdutos: 50 },
      ],
      formaPagamento: "CARTAO",
      cartaoCreditoId: "cartao",
      dataCompra: "2026-09-05",
      parcelaCartao: 1,
      pago: false,
      contaBancariaId: null,
    });
    expect(resultado).toMatchObject({ ok: true });
    expect(simulados.movimento).toHaveBeenCalledWith(expect.objectContaining({ quantidade: 20 }));
    expect(simulados.lancamentoCriar).toHaveBeenCalledWith({ data: expect.objectContaining({ cartaoCreditoId: "cartao", contaBancariaId: "conta-cartao", formaPagamentoId: "forma-boleto", dataVencimento: new Date("2026-09-20T12:00:00.000Z") }) });
  });
});
