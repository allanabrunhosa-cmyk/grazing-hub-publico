import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { EntradaSnapshot } from "@/lib/inventario/entrada-avulsa-historico";
import type { PagamentoEntradaInput } from "@/lib/inventario/entrada-avulsa-pagamento";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: vi.fn() }));
import { alterarPagamentoEntrada, consultarFinanceiroEntrada } from "@/lib/estoque/entrada-avulsa-financeiro";

const pagamento: PagamentoEntradaInput = { formaPagamento: "BOLETO", parcelas: [{ valor: 100, dataVencimento: "2026-11-20" }] };
const snapshot: EntradaSnapshot = { tipo: "COMPRA_SIMPLES", data: "2026-11-13", fornecedorId: "fornecedor", fornecedorNome: "Fornecedor fictício", frete: 0, desconto: 0, custosAdicionais: [], observacao: null, valorTotal: 100, itens: [], pagamento };
const autor = { id: "autor", nome: "Pessoa fictícia", perfilAcesso: { sistema: "ADMINISTRADOR", permissoes: {} }, permissoesPersonalizadas: {} };
function titulo() {
  return { id: "titulo-original", tipo: "DESPESA", descricao: "Compra fictícia", valor: new Prisma.Decimal(100), categoriaId: "cmv", fornecedorId: "fornecedor", pedidoVendaId: null,
    dataCompetencia: new Date("2026-11-13T15:00:00Z"), dataVencimento: new Date("2026-11-20T12:00:00Z"), updatedAt: new Date("2026-11-13T16:00:00Z"),
    status: "PENDENTE", dataPagamento: null as Date | null, contaBancariaId: null, formaPagamentoId: "boleto", formaPagamento: { nome: "Boleto" },
    cartaoCreditoId: null as string | null, cartaoCredito: null as { diaFechamento: number; diaVencimento: number } | null,
    movimentacaoBancaria: null as { id: string } | null, vinculoExtrato: null as { transacaoId: string } | null, itemFaturaId: null as string | null,
    liquidacoesCartao: [] as { id: string; pagamento: { revertidoEm: Date | null } }[], custosEntrega: [] as { id: string }[], observacoes: null, contraparteNome: null };
}
let titulos: ReturnType<typeof titulo>[];
const tx = {
  $executeRaw: vi.fn(), $executeRawUnsafe: vi.fn(), $queryRaw: vi.fn(),
  entradaAvulsaCompra: { findUnique: vi.fn(), update: vi.fn() },
  lancamentoFinanceiro: { findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  formaPagamento: { upsert: vi.fn() },
};
const transacao = tx as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.clearAllMocks();
  titulos = [titulo()];
  tx.entradaAvulsaCompra.findUnique.mockResolvedValue({ id: "compra", valorTotal: new Prisma.Decimal(100), fornecedorId: "fornecedor" });
  tx.lancamentoFinanceiro.findMany.mockImplementation(async args => args.select ? titulos.map(t => ({ id: t.id })) : titulos);
  tx.lancamentoFinanceiro.updateMany.mockResolvedValue({ count: 1 });
  tx.lancamentoFinanceiro.create.mockImplementation(async () => ({ id: `novo-${tx.lancamentoFinanceiro.create.mock.calls.length}` }));
  tx.formaPagamento.upsert.mockResolvedValue({ id: "forma-nova" });
});

describe("fonte financeira e correção da entrada avulsa", () => {
  it("projeta títulos atuais e não o pagamento antigo do snapshot", async () => {
    titulos[0].formaPagamento.nome = "Pix";
    titulos[0].dataVencimento = new Date("2026-12-05T12:00:00Z");
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.pagamento).toMatchObject({ formaPagamento: "PIX", parcelas: [{ valor: 100, dataVencimento: "2026-12-05" }] });
    expect(dto.bloqueio).toBeUndefined();
    expect(tx.lancamentoFinanceiro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { origemEntradaAvulsaCompraId: "compra", status: { not: "CANCELADO" } } }));
  });

  it.each([
    ["baixa", (t: ReturnType<typeof titulo>) => { t.status = "BAIXADO"; }],
    ["data de pagamento", (t: ReturnType<typeof titulo>) => { t.dataPagamento = new Date(); }],
    ["movimento bancário", (t: ReturnType<typeof titulo>) => { t.movimentacaoBancaria = { id: "movimento" }; }],
    ["extrato", (t: ReturnType<typeof titulo>) => { t.vinculoExtrato = { transacaoId: "extrato" }; }],
    ["fatura", (t: ReturnType<typeof titulo>) => { t.itemFaturaId = "item"; }],
    ["liquidação parcial", (t: ReturnType<typeof titulo>) => { t.liquidacoesCartao = [{ id: "liquidacao", pagamento: { revertidoEm: null } }]; }],
    ["custo de entrega", (t: ReturnType<typeof titulo>) => { t.custosEntrega = [{ id: "custo" }]; }],
  ] as const)("bloqueia alteração com %s e permite manter o mesmo plano", async (_, alterar) => {
    alterar(titulos[0]);
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.bloqueio).toBeTruthy();
    const igual = await alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, revisao: dto.revisao }, autor);
    expect(igual.mudou).toBe(false);
    expect(tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
    await expect(alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, formaPagamento: "PIX", revisao: dto.revisao }, autor)).rejects.toThrow();
    expect(tx.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });

  it("recusa revisão antiga mesmo sem mudança do plano", async () => {
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    titulos[0].updatedAt = new Date("2026-11-13T17:00:00Z");
    await expect(alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, revisao: dto.revisao }, autor)).rejects.toThrow("outra pessoa");
    expect(tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
  });

  it("exige a permissão financeira atual para substituir os títulos", async () => {
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    await expect(alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, formaPagamento: "PIX", revisao: dto.revisao }, { ...autor, perfilAcesso: null })).rejects.toThrow("acesso atual");
    expect(tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
  });

  it("cancela os IDs antigos e cria todo o plano sem alterar a competência nem criar estoque", async () => {
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    const resultado = await alterarPagamentoEntrada(transacao, "compra", snapshot, { formaPagamento: "PIX", revisao: dto.revisao,
      parcelas: [{ valor: 60, dataVencimento: "2026-11-20" }, { valor: 40, dataVencimento: "2026-12-20" }] }, autor);
    expect(resultado).toMatchObject({ mudou: true, anteriores: ["titulo-original"], novos: ["novo-1", "novo-2"] });
    expect(tx.lancamentoFinanceiro.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "PENDENTE", dataPagamento: null, itemFaturaId: null }), data: { status: "CANCELADO" } }));
    const criados = tx.lancamentoFinanceiro.create.mock.calls.map(([args]) => args.data);
    expect(criados.map(t => t.valor)).toEqual([60, 40]);
    for (const t of criados) {
      expect(t).toMatchObject({ origemEntradaAvulsaCompraId: "compra", categoriaId: "cmv", dataCompetencia: new Date("2026-11-13T15:00:00Z") });
      expect(t.origemMovimentacaoEstoqueId).toBeUndefined();
    }
    expect(criados[0].recorrenciaGrupoId).toBe(criados[1].recorrenciaGrupoId);
    expect(criados[0].recorrenciaGrupoId).toBeTruthy();
  });

  it("bloqueia títulos incompletos ou condições que não podem ser reconstruídas", async () => {
    titulos[0].valor = new Prisma.Decimal(99.99);
    expect((await consultarFinanceiroEntrada(transacao, "compra", snapshot)).bloqueio).toContain("total");
    titulos[0].valor = new Prisma.Decimal(100);
    titulos[0].formaPagamento.nome = "Cartão de crédito";
    titulos[0].cartaoCreditoId = "cartao";
    titulos[0].cartaoCredito = { diaFechamento: 10, diaVencimento: 20 };
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.bloqueio).toContain("não está registrada");
    expect(dto.pagamento.dataCompra).toBeNull();
  });

  it("reconstrói metadata legada apenas quando corresponde ao calendário atual", async () => {
    titulos[0].formaPagamento.nome = "Cartão de crédito";
    titulos[0].cartaoCreditoId = "cartao";
    titulos[0].cartaoCredito = { diaFechamento: 10, diaVencimento: 20 };
    const legado = { ...snapshot, pagamento: undefined, dadosOriginais: { cartaoCreditoId: "cartao", dataCompra: "2026-11-05", parcelaCartao: "1" } };
    expect((await consultarFinanceiroEntrada(transacao, "compra", legado)).pagamento.dataCompra).toBe("2026-11-05");
    expect((await consultarFinanceiroEntrada(transacao, "compra", { ...legado, dadosOriginais: { ...legado.dadosOriginais, cartaoCreditoId: "outro-cartao" } })).bloqueio).toContain("não está registrada");
    titulos[0].dataVencimento = new Date("2026-11-21T12:00:00Z");
    expect((await consultarFinanceiroEntrada(transacao, "compra", legado)).bloqueio).toContain("não correspondem");
  });

  it("não cria o plano novo quando a baixa concorrente ganha o CAS", async () => {
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    tx.lancamentoFinanceiro.updateMany.mockResolvedValue({ count: 0 });
    await expect(alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, formaPagamento: "PIX", revisao: dto.revisao }, autor)).rejects.toThrow("mudou durante");
    expect(tx.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });
});
