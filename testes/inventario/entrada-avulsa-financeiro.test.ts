import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { EntradaSnapshot } from "@/lib/inventario/entrada-avulsa-historico";
import type { PagamentoEntradaInput } from "@/lib/inventario/entrada-avulsa-pagamento";
import type { EntradaAvulsaInput } from "@/app/(protegido)/inventario/entrada-avulsa/actions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/estoque/numero-entrada", () => ({ numeroEntradaLegada: vi.fn(async () => 17) }));
import { alterarPagamentoEntrada, consultarFinanceiroEntrada } from "@/lib/estoque/entrada-avulsa-financeiro";
import { gravarRegistroEntrada } from "@/lib/estoque/entrada-avulsa-servidor";
import { registrarAtividade } from "@/lib/atividades/registro";
import { diferencasPermitidas } from "@/lib/atividades/privacidade";

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
  cartaoCredito: { findUnique: vi.fn() },
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
  tx.cartaoCredito.findUnique.mockResolvedValue({ id: "cartao", ativo: true, diaFechamento: 10, diaVencimento: 20, contaBancariaId: "conta-cartao", contaBancaria: { ativo: true } });
});

describe("fonte financeira e correção da entrada avulsa", () => {
  it.each(["PIX", "CARTAO"] as const)("audita o plano %s explícito sem depender de campos legados duplicados", async formaPagamento => {
    const plano: PagamentoEntradaInput = { formaPagamento, parcelas: [{ valor: 100, dataVencimento: "2026-12-20" }],
      ...(formaPagamento === "CARTAO" ? { cartaoCreditoId: "cartao", dataCompra: "2026-11-05", parcelaCartao: 2 } : {}) };
    const input: EntradaAvulsaInput = { chave: "chave-criacao-auditavel", tipo: "COMPRA_SIMPLES", data: "2026-11-13", fornecedorId: "fornecedor",
      itens: [{ insumoId: "produto", localId: "local", quantidade: 1, valorProdutos: 100 }], frete: 0, desconto: 0, custosAdicionais: [], observacao: null,
      pago: false, dataVencimento: null, dataPagamento: null, contaBancariaId: null, pagamento: plano };
    const gravacao = {
      insumo: { findMany: vi.fn(async () => [{ id: "produto", nome: "Produto fictício", unidade: "KG" }]) },
      localEstoque: { findMany: vi.fn(async () => [{ id: "local", nome: "Local fictício" }]) },
      fornecedor: { findUnique: vi.fn(async () => ({ nome: "Fornecedor fictício" })) },
      entradaAvulsaRegistro: { create: vi.fn(async () => ({ id: "registro" })) },
      entradaAvulsaVersao: { create: vi.fn() }, movimentacaoEstoque: { updateMany: vi.fn() },
    };
    await gravarRegistroEntrada(gravacao as unknown as Prisma.TransactionClient, input, autor, "hash-do-input-original", "compra", ["movimento"]);
    const registro = gravacao.entradaAvulsaRegistro.create.mock.calls[0] as unknown as [{ data: { snapshot: EntradaSnapshot; hashOperacao: string } }];
    expect(registro[0].data.snapshot.pagamento).toEqual(plano);
    expect(registro[0].data.snapshot.dadosOriginais).toMatchObject({ formaPagamento, dataVencimento: "2026-12-20", cartaoCreditoId: plano.cartaoCreditoId ?? null,
      dataCompra: plano.dataCompra ?? null, parcelaCartao: String(plano.parcelaCartao ?? 1) });
    expect(registro[0].data.hashOperacao).toBe("hash-do-input-original");
    expect(gravacao.entradaAvulsaVersao.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ depois: registro[0].data.snapshot }) }));
  });

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
    const evento = vi.mocked(registrarAtividade).mock.calls[0][2];
    expect(diferencasPermitidas(evento.antes, true)).toEqual({ tipo: "BOLETO", itens: 1, dataVencimento: "2026-11-20", valorTotal: 100, camposAlterados: "pagamento" });
    expect(diferencasPermitidas(evento.depois, true)).toEqual({ tipo: "PIX", itens: 2, dataVencimento: "2026-11-20", valorTotal: 100, camposAlterados: "pagamento" });
  });

  it("bloqueia total incompleto e orienta completar metadata antiga do cartão sem travar o editor", async () => {
    titulos[0].valor = new Prisma.Decimal(99.99);
    expect((await consultarFinanceiroEntrada(transacao, "compra", snapshot)).bloqueio).toContain("total");
    titulos[0].valor = new Prisma.Decimal(100);
    titulos[0].formaPagamento.nome = "Cartão de crédito";
    titulos[0].cartaoCreditoId = "cartao";
    titulos[0].cartaoCredito = { diaFechamento: 10, diaVencimento: 20 };
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.bloqueio).toBeUndefined();
    expect(dto.aviso).toContain("não está registrada");
    expect(dto.pagamento.dataCompra).toBeNull();
  });

  it("reconstrói metadata legada apenas quando corresponde ao calendário atual", async () => {
    titulos[0].formaPagamento.nome = "Cartão de crédito";
    titulos[0].cartaoCreditoId = "cartao";
    titulos[0].cartaoCredito = { diaFechamento: 10, diaVencimento: 20 };
    const legado = { ...snapshot, pagamento: undefined, dadosOriginais: { cartaoCreditoId: "cartao", dataCompra: "2026-11-05", parcelaCartao: "1" } };
    expect((await consultarFinanceiroEntrada(transacao, "compra", legado)).pagamento.dataCompra).toBe("2026-11-05");
    expect((await consultarFinanceiroEntrada(transacao, "compra", { ...legado, dadosOriginais: { ...legado.dadosOriginais, cartaoCreditoId: "outro-cartao" } })).aviso).toContain("não está registrada");
    titulos[0].dataVencimento = new Date("2026-11-21T12:00:00Z");
    expect((await consultarFinanceiroEntrada(transacao, "compra", legado)).aviso).toContain("não correspondem");
  });

  it("normaliza espaços e caixa do rótulo conhecido sem substituir um plano igual", async () => {
    titulos[0].formaPagamento.nome = "  bOlEtO  ";
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.aviso).toBeUndefined();
    expect((await alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, revisao: dto.revisao }, autor)).mudou).toBe(false);
    expect(tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
  });

  it.each([null, "Forma antiga desconhecida"])("permite confirmar plano explícito quando a forma antiga é %s sem esconder correção como no-op", async nome => {
    Object.assign(titulos[0], { formaPagamento: nome === null ? null : { nome }, formaPagamentoId: nome === null ? null : "forma-antiga" });
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.bloqueio).toBeUndefined();
    expect(dto.aviso).toContain("Informe a forma");
    const resultado = await alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, revisao: dto.revisao }, autor);
    expect(resultado.mudou).toBe(true);
    expect(tx.lancamentoFinanceiro.create).toHaveBeenCalledTimes(1);
    const evento = vi.mocked(registrarAtividade).mock.calls[0][2];
    expect(diferencasPermitidas(evento.antes, true)).toEqual({ tipo: "NAO_RECONSTRUIDO", itens: 1, dataVencimento: "2026-11-20", valorTotal: 100, camposAlterados: "pagamento" });
    expect(diferencasPermitidas(evento.depois, true)).toEqual({ tipo: "BOLETO", itens: 1, dataVencimento: "2026-11-20", valorTotal: 100, camposAlterados: "pagamento" });
  });

  it("reparcela título com fornecedor nulo e preserva a contraparte registrada", async () => {
    Object.assign(titulos[0], { fornecedorId: null, contraparteNome: "Contraparte fictícia anterior" });
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.bloqueio).toBeUndefined();
    await alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, revisao: dto.revisao, parcelas: [{ valor: 60, dataVencimento: "2026-11-20" }, { valor: 40, dataVencimento: "2026-12-20" }] }, autor);
    for (const [args] of tx.lancamentoFinanceiro.create.mock.calls) expect(args.data).toMatchObject({ fornecedorId: null, contraparteNome: "Contraparte fictícia anterior" });
  });

  it("permite substituir forma incoerente com cartão quando não há pagamento nem vínculo", async () => {
    titulos[0].cartaoCreditoId = "cartao-antigo";
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.bloqueio).toBeUndefined();
    expect(dto.aviso).toBeTruthy();
    await alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, formaPagamento: "PIX", revisao: dto.revisao }, autor);
    expect(tx.lancamentoFinanceiro.create).toHaveBeenCalledWith({ data: expect.objectContaining({ cartaoCreditoId: null, formaPagamentoId: "forma-nova" }) });
  });

  it("permite informar cartão e data novos quando falta metadata antiga e valida cada vencimento no servidor", async () => {
    titulos[0].formaPagamento.nome = "Cartão de crédito";
    titulos[0].cartaoCreditoId = "cartao";
    titulos[0].cartaoCredito = { diaFechamento: 10, diaVencimento: 20 };
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    const entrada = { formaPagamento: "CARTAO" as const, cartaoCreditoId: "cartao", dataCompra: "2026-11-05", parcelaCartao: 1, revisao: dto.revisao,
      parcelas: [{ valor: 50, dataVencimento: "2026-11-20" }, { valor: 50, dataVencimento: "2026-12-20" }] };
    await expect(alterarPagamentoEntrada(transacao, "compra", snapshot, { ...entrada, parcelas: [{ valor: 50, dataVencimento: "2026-11-21" }, entrada.parcelas[1]] }, autor)).rejects.toThrow("não corresponde à fatura");
    expect(tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
    expect((await alterarPagamentoEntrada(transacao, "compra", snapshot, entrada, autor)).mudou).toBe(true);
    expect(tx.lancamentoFinanceiro.create).toHaveBeenCalledTimes(2);
    expect(tx.lancamentoFinanceiro.create.mock.calls.map(([args]) => args.data.dataVencimento)).toEqual([new Date("2026-11-20T12:00:00Z"), new Date("2026-12-20T12:00:00Z")]);
  });

  it.each(["categoriaId", "dataCompetencia", "fornecedorId", "contraparteNome"] as const)("mantém bloqueio estrutural por %s diferente entre títulos", async campo => {
    titulos[0].valor = new Prisma.Decimal(50);
    const segundo = { ...titulo(), id: "segundo", valor: new Prisma.Decimal(50) };
    Object.assign(segundo, { [campo]: campo === "dataCompetencia" ? new Date("2026-11-14T15:00:00Z") : "outro" });
    titulos.push(segundo);
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.bloqueio).toContain("incompatíveis");
    await expect(alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, formaPagamento: "PIX", revisao: dto.revisao }, autor)).rejects.toThrow("incompatíveis");
    expect(tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
  });

  it("ausência de forma não contorna proteção de uma baixa existente", async () => {
    Object.assign(titulos[0], { formaPagamento: null, formaPagamentoId: null, status: "BAIXADO" });
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    expect(dto.aviso).toBeTruthy();
    expect(dto.bloqueio).toContain("baixa");
    await expect(alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, revisao: dto.revisao }, autor)).rejects.toThrow("baixa");
    expect(tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
  });

  it("não cria o plano novo quando a baixa concorrente ganha o CAS", async () => {
    const dto = await consultarFinanceiroEntrada(transacao, "compra", snapshot);
    tx.lancamentoFinanceiro.updateMany.mockResolvedValue({ count: 0 });
    await expect(alterarPagamentoEntrada(transacao, "compra", snapshot, { ...pagamento, formaPagamento: "PIX", revisao: dto.revisao }, autor)).rejects.toThrow("mudou durante");
    expect(tx.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  });
});
