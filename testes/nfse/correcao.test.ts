import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  transacao: vi.fn(), usuario: vi.fn(), nota: vi.fn(), atualizarNota: vi.fn(), atualizar: vi.fn(), criar: vi.fn(), vincular: vi.fn(), historico: vi.fn(), memoria: vi.fn(), custos: vi.fn(), preparar: vi.fn(), forma: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transacao } }));
vi.mock("@/lib/financeiro/custos-entrega", () => ({ travarCustosEntrega: vi.fn(), exigirDespesaSemCustoEntrega: mocks.custos }));
vi.mock("@/lib/notas-fiscais/pagamentos", () => ({ prepararPagamento: mocks.preparar }));
import { corrigirNfse, obterCorrecaoNfse, type CorrecaoNfseInput } from "@/lib/nfse/correcao";

const sessao = { userId: "usuario", nome: "Responsável", versao: 0 } as SessaoAtual;
function titulo(dados: Record<string, unknown> = {}) {
  return { id: "titulo", updatedAt: new Date("2026-11-16T12:00:00Z"), descricao: "SERVIÇO", categoriaId: "categoria", valor: new Prisma.Decimal(100), status: "PENDENTE", dataVencimento: new Date("2026-11-20T12:00:00Z"), dataPagamento: null,
    cartaoCreditoId: null, contaBancariaId: null, formaPagamentoId: "boleto", formaPagamento: { id: "boleto", nome: "Boleto" }, movimentacaoBancaria: null, vinculoExtrato: null, liquidacoesCartao: [], itemFaturaId: null, pedidoVendaId: null, ...dados };
}
function nota(t = titulo()) {
  return { id: "nota", status: "LANCADA", updatedAt: new Date("2026-11-16T12:00:00Z"), canceladaEm: null, valorLiquido: new Prisma.Decimal(100), valorServico: new Prisma.Decimal(100), fornecedorId: "fornecedor", prestadorNome: "Prestador fictício", dataEmissao: new Date("2026-11-01T12:00:00Z"), dataCompetencia: null,
    lancamentos: [{ lancamentoFinanceiroId: t.id, lancamentoFinanceiro: t }] };
}
let atual = nota();
beforeEach(() => {
  vi.resetAllMocks(); atual = nota();
  mocks.usuario.mockResolvedValue({ id: "usuario", nome: "Responsável", ativo: true, senhaDefinida: true, sessaoVersao: 0, excluidoEm: null, perfilAcesso: { sistema: "ADMINISTRADOR" } });
  mocks.nota.mockImplementation(async () => atual);
  mocks.memoria.mockResolvedValue(null);
  mocks.atualizar.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
  mocks.criar.mockImplementation(async ({ data }) => ({ id: "novo", ...data }));
  mocks.forma.mockResolvedValue({ id: "forma" });
  mocks.preparar.mockImplementation(async p => ({ formaPagamento: p.formaPagamento, cartaoCreditoId: p.cartaoCreditoId ?? null, contaBancariaId: p.cartaoCreditoId ? "conta" : null, dataVencimento: new Date(`${p.dataVencimento}T12:00:00Z`) }));
  mocks.transacao.mockImplementation(async executar => executar({
    $executeRaw: vi.fn(), $queryRaw: vi.fn(), usuario: { findUnique: mocks.usuario }, notaFiscalServico: { findUnique: mocks.nota, update: mocks.atualizarNota },
    historicoAcesso: { findFirst: mocks.memoria, create: mocks.historico }, categoriaFinanceira: { findUnique: vi.fn().mockResolvedValue({ id: "categoria", ativo: true, excluidoEm: null, grupo: "DESPESAS_OPERACIONAIS" }) },
    lancamentoFinanceiro: { update: mocks.atualizar, create: mocks.criar }, notaFiscalServicoLancamento: { create: mocks.vincular }, formaPagamento: { upsert: mocks.forma },
  }));
});
async function entrada(): Promise<CorrecaoNfseInput> {
  const contexto = await obterCorrecaoNfse("nota", sessao);
  if ("erro" in contexto) throw new Error(contexto.erro);
  return { nfseId: "nota", ...contexto, motivo: "Correção do lançamento de teste" };
}

describe("correção local de NFS-e aceita", () => {
  it("carrega pagamento existente sem inventar data da compra ausente no legado", async () => {
    atual = nota(titulo({ cartaoCreditoId: "cartao", formaPagamento: { nome: "Cartão de crédito" } }));
    const contexto = await obterCorrecaoNfse("nota", sessao);
    expect(contexto).toMatchObject({ descricao: "SERVIÇO", parcelas: [{ id: "titulo", valor: 100, formaPagamento: "CARTAO", cartaoCreditoId: "cartao", dataCompra: null }] });
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("corrige pagamento preservando a identidade e sem criar outra despesa", async () => {
    const input = await entrada(); input.parcelas[0].formaPagamento = "PIX";
    expect(await corrigirNfse(input, sessao)).toEqual({ ok: true });
    expect(mocks.atualizar).toHaveBeenCalledExactlyOnceWith({ where: { id: "titulo" }, data: expect.objectContaining({ formaPagamentoId: "forma", cartaoCreditoId: null, valor: 100 }) });
    expect(mocks.criar).not.toHaveBeenCalled(); expect(mocks.vincular).not.toHaveBeenCalled();
    expect(mocks.historico).toHaveBeenCalledWith({ data: expect.objectContaining({ autorId: sessao.userId, acao: "CORRECAO_NFSE", depois: expect.objectContaining({ motivo: input.motivo }) }) });
  });
  it("permite descrição em parcela paga sem mexer no pagamento", async () => {
    atual = nota(titulo({ status: "BAIXADO", dataPagamento: new Date("2026-11-15T12:00:00Z"), movimentacaoBancaria: { id: "movimento" } }));
    const input = await entrada(); input.descricao = "DESCRIÇÃO CORRIGIDA";
    expect(await corrigirNfse(input, sessao)).toEqual({ ok: true });
    expect(mocks.atualizar).toHaveBeenCalledWith({ where: { id: "titulo" }, data: { descricao: input.descricao, categoriaId: "categoria" } });
    expect(mocks.preparar).not.toHaveBeenCalled();
  });
  it("bloqueia mudança de pagamento vinculado à fatura antes de gravar", async () => {
    atual = nota(titulo({ itemFaturaId: "item-fatura" }));
    const input = await entrada(); input.parcelas[0].formaPagamento = "PIX";
    expect(await corrigirNfse(input, sessao)).toMatchObject({ erro: expect.stringContaining("vínculo financeiro") });
    expect(mocks.atualizar).not.toHaveBeenCalled(); expect(mocks.historico).not.toHaveBeenCalled();
  });
  it("não deixa alterar a data da compra de título protegido", async () => {
    atual = nota(titulo({ cartaoCreditoId: "cartao", itemFaturaId: "item-fatura" }));
    const input = await entrada(); input.parcelas[0].dataCompra = "2026-11-10";
    expect(await corrigirNfse(input, sessao)).toMatchObject({ erro: expect.stringContaining("vínculo financeiro") });
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("permite corrigir uma liquidação de cartão já revertida", async () => {
    atual = nota(titulo({ liquidacoesCartao: [{ id: "liquidacao", valor: new Prisma.Decimal(100), pagamento: { revertidoEm: new Date("2026-11-16T12:00:00Z") } }] }));
    const input = await entrada(); input.parcelas[0].formaPagamento = "PIX";
    expect(await corrigirNfse(input, sessao)).toEqual({ ok: true });
  });
  it("recusa versão antiga após outra edição ou baixa", async () => {
    const input = await entrada(); atual = nota(titulo({ updatedAt: new Date("2026-11-16T13:00:00Z") }));
    expect(await corrigirNfse(input, sessao)).toMatchObject({ erro: expect.stringContaining("mudaram") });
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("revalida sessão e permissões dentro da transação", async () => {
    const input = await entrada(); mocks.usuario.mockResolvedValue({ ativo: false });
    expect(await corrigirNfse(input, sessao)).toMatchObject({ erro: expect.stringContaining("sessão expirou") });
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("nega escrita quando a permissão foi removida", async () => {
    const input = await entrada(); mocks.usuario.mockResolvedValue({ id: "usuario", nome: "Responsável", ativo: true, senhaDefinida: true, sessaoVersao: 0, excluidoEm: null, perfilAcesso: { sistema: "PERSONALIZADO", permissoes: {} }, permissoesPersonalizadas: {} });
    expect(await corrigirNfse(input, sessao)).toMatchObject({ erro: expect.stringContaining("perfil não permite") });
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("recusa parcela de outra nota e total divergente", async () => {
    const input = await entrada(); input.parcelas[0].id = "outra-nota";
    expect(await corrigirNfse(input, sessao)).toMatchObject({ erro: expect.stringContaining("outra nota") });
    input.parcelas[0].id = "titulo"; input.parcelas[0].valor = 99.99;
    expect(await corrigirNfse(input, sessao)).toMatchObject({ erro: expect.stringContaining("soma das parcelas") });
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("reestrutura parcelas com cancelamento lógico e vínculo de novas despesas", async () => {
    const input = await entrada(); input.parcelas = [{ ...input.parcelas[0], id: undefined, numero: "001", valor: 60 }, { ...input.parcelas[0], id: undefined, numero: "002", valor: 40, dataVencimento: "2026-12-20" }];
    expect(await corrigirNfse(input, sessao)).toEqual({ ok: true });
    expect(mocks.atualizar).toHaveBeenCalledWith({ where: { id: "titulo" }, data: { status: "CANCELADO" } });
    expect(mocks.criar).toHaveBeenCalledTimes(2); expect(mocks.vincular).toHaveBeenCalledTimes(2);
    expect(mocks.atualizarNota).toHaveBeenCalledWith({ where: { id: "nota" }, data: { status: "LANCADA", dataVencimento: new Date("2026-11-20T00:00:00Z") } });
  });
  it("sincroniza o vencimento da nota com a primeira parcela efetiva", async () => {
    const input = await entrada(); input.parcelas[0].dataVencimento = "2026-12-05";
    expect(await corrigirNfse(input, sessao)).toEqual({ ok: true });
    expect(mocks.atualizarNota).toHaveBeenCalledWith({ where: { id: "nota" }, data: { status: "LANCADA", dataVencimento: new Date("2026-12-05T00:00:00Z") } });
  });
  it("recusa precisão monetária excedente, motivo curto e duplicatas", async () => {
    const input = await entrada(); input.motivo = "curto";
    expect(await corrigirNfse(input, sessao)).toHaveProperty("erro"); input.motivo = "Correção validada para teste"; input.parcelas[0].valor = 100.001;
    expect(await corrigirNfse(input, sessao)).toHaveProperty("erro"); input.parcelas[0].valor = 100; input.parcelas.push(input.parcelas[0]);
    expect(await corrigirNfse(input, sessao)).toHaveProperty("erro"); expect(mocks.atualizar).not.toHaveBeenCalled();
  });
});
