import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";

const fronteiras = vi.hoisted(() => ({ transacao: vi.fn(), autor: vi.fn(), auditar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: fronteiras.transacao } }));
vi.mock("@/lib/financeiro/faturas/acesso", () => ({ autorFatura: fronteiras.autor, auditarFatura: fronteiras.auditar }));

import { consultarCorrespondencias, vincularItem } from "@/lib/financeiro/faturas/servico";

const data = new Date("2026-11-10T00:00:00.000Z");
const vencimento = new Date("2026-11-20T00:00:00.000Z");
const versao = data.toISOString();
const sessao = { userId: "operador-ficticio", versao: 0 } as SessaoAtual;
const decimal = (valor: number) => new Prisma.Decimal(valor);

function criarCenario() {
  const parcela = { id: "parcela-ficticia", notaFiscalId: "nota-ficticia", numero: "001", valor: decimal(100), notaFiscal: { chaveAcesso: "1".repeat(44), fornecedorNome: "Fornecedor fictício" } };
  const lancamentos = [
    { id: "l1", descricao: "NF-e fictícia — produto A", valor: decimal(40) },
    { id: "l2", descricao: "NF-e fictícia — produto B", valor: decimal(60) },
  ].map(l => ({
    ...l, tipo: "DESPESA", status: "PENDENTE", itemFaturaId: null as string | null, cartaoCreditoId: "cartao-ficticio", pedidoVendaId: null,
    fornecedorId: "fornecedor-ficticio", fornecedor: { nome: "Fornecedor fictício" }, cartaoCredito: { nome: "Cartão fictício" },
    dataCompetencia: data, dataVencimento: vencimento, dataPagamento: null, updatedAt: data, movimentacaoBancaria: null, vinculoExtrato: null,
    notaFiscalItemLancamento: { notaFiscalDuplicataId: parcela.id, notaFiscalDuplicata: parcela },
  }));
  const componentes = lancamentos.map(l => ({ notaFiscalDuplicataId: parcela.id, lancamentoFinanceiroId: l.id, valor: l.valor, notaFiscalDuplicata: parcela, lancamentoFinanceiro: l }));
  const item = {
    id: "item-ficticio", linha: 1, valor: decimal(100), ignoradoEm: null, compensadoComId: null,
    revisado: true, estado: "CLASSIFICADO", categoriaId: "categoria-ficticia", categoria: { ativo: true, excluidoEm: null },
    fornecedorId: null, fornecedor: null, responsavelId: null, responsavel: null, centroCustoId: null, centroCusto: null,
    dataCompra: data, dataCompetencia: data, descricaoOriginal: "Compra fictícia", descricaoNormalizada: "COMPRA FICTICIA", estabelecimentoNormalizado: "FORNECEDOR FICTICIO",
    sugestao: null, observacoes: null, lancamentos: [] as typeof lancamentos,
  };
  const fatura = {
    id: "fatura-ficticia", versao: 1, canceladaEm: null, cartaoId: "cartao-ficticio", vencimento, totalInformado: decimal(100),
    cartao: { contaBancariaId: "banco-ficticio", toleranciaDias: 7 }, itens: [item], pagamentos: [],
  };
  type Consulta = { where?: { id?: { in?: string[] }; lancamentoFinanceiroId?: { in?: string[] } } };
  const tx = {
    $queryRaw: vi.fn(async (sql: unknown) => { void sql; return []; }),
    faturaCartao: {
      findUnique: vi.fn(async () => fatura), findUniqueOrThrow: vi.fn(async () => fatura),
      update: vi.fn(async () => { fatura.versao += 1; return fatura; }),
    },
    notaFiscalDuplicata: { findMany: vi.fn(async () => [{ ...parcela, lancamentos: componentes }]) },
    notaFiscalItemLancamento: { findMany: vi.fn(async (consulta: Consulta) => {
      const ids = consulta.where?.lancamentoFinanceiroId?.in;
      return ids ? componentes.filter(c => ids.includes(c.lancamentoFinanceiroId)) : componentes;
    }) },
    lancamentoFinanceiro: {
      findMany: vi.fn(async (consulta: Consulta) => consulta.where?.id?.in ? lancamentos.filter(l => consulta.where!.id!.in!.includes(l.id)) : []),
      create: vi.fn(),
      updateMany: vi.fn(async (consulta: { where: { id: { in: string[] } }; data: { itemFaturaId?: string; cartaoCreditoId?: string } }) => {
        for (const l of lancamentos.filter(l => consulta.where.id.in.includes(l.id))) Object.assign(l, consulta.data);
        item.lancamentos = lancamentos.filter(l => l.itemFaturaId === item.id);
        return { count: consulta.where.id.in.length };
      }),
    },
    itemFaturaCartao: {
      findFirst: vi.fn(async () => null),
      update: vi.fn(async (consulta: { data: object }) => Object.assign(item, consulta.data)),
    },
    fornecedor: { findMany: vi.fn(async () => []) },
    categoriaFinanceira: { findFirst: vi.fn(async () => ({ id: "categoria-ficticia", ativo: true, grupo: "DESPESAS_OPERACIONAIS", centroCustoId: null })) },
    liquidacaoCartao: { deleteMany: vi.fn(async () => ({ count: 0 })), createMany: vi.fn() },
    movimentacaoBancaria: { create: vi.fn() },
  };
  return { tx, fatura, item, parcela, lancamentos, componentes };
}

let cenario: ReturnType<typeof criarCenario>;
const selecionar = (ids = ["l1", "l2"]) => ids.map(id => ({ id, versao }));
function textoSql(sql: unknown): string {
  if (Array.isArray(sql)) return sql.join("?");
  return (sql as { strings?: string[] }).strings?.join("?") ?? String(sql);
}
function esperarSemEscrita() {
  expect(cenario.tx.lancamentoFinanceiro.updateMany).not.toHaveBeenCalled();
  expect(cenario.tx.lancamentoFinanceiro.create).not.toHaveBeenCalled();
  expect(cenario.tx.itemFaturaCartao.update).not.toHaveBeenCalled();
  expect(cenario.tx.faturaCartao.update).not.toHaveBeenCalled();
  expect(cenario.tx.movimentacaoBancaria.create).not.toHaveBeenCalled();
  expect(fronteiras.auditar).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  cenario = criarCenario();
  fronteiras.transacao.mockImplementation(async (executar: (tx: typeof cenario.tx) => Promise<unknown>) => executar(cenario.tx));
  fronteiras.autor.mockResolvedValue({ id: "operador-ficticio", nome: "Operador fictício", pode: () => true });
});

describe("fatura: fluxo do servidor com lançamentos inteiros", () => {
  it("oferece uma parcela inteira de NF-e com total e versões dos dois produtos", async () => {
    const resposta = await consultarCorrespondencias(cenario.fatura.id, cenario.item.id);
    expect(resposta.candidatos).toHaveLength(1);
    expect(resposta.candidatos[0]).toMatchObject({ id: "l1", valor: 10000, notaGrupo: cenario.parcela.id, componentes: 2, lancamentos: selecionar() });
    expect(resposta.candidatos[0].descricao).toContain("Parcela 001");
    expect(resposta.candidatos[0].descricao).not.toMatch(/produto A|produto B/);
    esperarSemEscrita();
  });

  it("não oferece subtotal quando os componentes não fecham com o valor da parcela", async () => {
    cenario.parcela.valor = decimal(110);
    const resposta = await consultarCorrespondencias(cenario.fatura.id, cenario.item.id);
    expect(resposta.candidatos).toEqual([]);
    esperarSemEscrita();
  });

  it("bloqueia somente liquidações ativas, preservando a elegibilidade depois da reversão e desvinculação", async () => {
    await consultarCorrespondencias(cenario.fatura.id, cenario.item.id);
    const livreDeLiquidacaoAtiva = { liquidacoesCartao: { none: { pagamento: { revertidoEm: null } } } };
    expect(cenario.tx.lancamentoFinanceiro.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([expect.objectContaining(livreDeLiquidacaoAtiva)]) }),
    }));
    expect(cenario.tx.notaFiscalDuplicata.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        lancamentos: {
          some: { lancamentoFinanceiro: expect.objectContaining(livreDeLiquidacaoAtiva) },
          every: { OR: expect.arrayContaining([{ lancamentoFinanceiro: expect.objectContaining(livreDeLiquidacaoAtiva) }]) },
        },
      },
    }));
    esperarSemEscrita();
  });

  it("recusa uma parte da parcela mesmo quando ela coincide com o valor do item da fatura", async () => {
    cenario.item.valor = decimal(40);
    cenario.fatura.totalInformado = decimal(40);
    await expect(vincularItem(cenario.fatura.id, 1, cenario.item.id, { lancamentos: selecionar(["l1"]) }, sessao)).rejects.toThrow(/inteiro|completo/);
    esperarSemEscrita();
  });

  it("trava a nota e todos os componentes antes de recusar seleção parcial", async () => {
    await expect(vincularItem(cenario.fatura.id, 1, cenario.item.id, { lancamentos: selecionar(["l1"]) }, sessao)).rejects.toThrow(/inteiro|completo/);
    const consultas = cenario.tx.$queryRaw.mock.calls.map(([sql]) => textoSql(sql));
    const nota = consultas.findIndex(sql => sql.includes('"NotaFiscalRecebida"'));
    const despesas = consultas.findIndex(sql => sql.includes('"LancamentoFinanceiro"'));
    expect(nota).toBeGreaterThan(-1);
    expect(despesas).toBeGreaterThan(nota);
    const trava = cenario.tx.$queryRaw.mock.calls[despesas][0] as { values: unknown[] };
    expect(trava.values).toEqual(["l1", "l2"]);
    esperarSemEscrita();
  });

  it("rejeita a seleção completa se uma versão mudou antes da confirmação", async () => {
    cenario.lancamentos[1].updatedAt = new Date("2026-11-11T00:00:00.000Z");
    await expect(vincularItem(cenario.fatura.id, 1, cenario.item.id, { lancamentos: selecionar() }, sessao)).rejects.toThrow(/alterada/);
    esperarSemEscrita();
  });

  it("rejeita composição modificada sem vínculo, baixa ou auditoria", async () => {
    cenario.parcela.valor = decimal(110);
    await expect(vincularItem(cenario.fatura.id, 1, cenario.item.id, { lancamentos: selecionar() }, sessao)).rejects.toThrow(/composição|composi/);
    esperarSemEscrita();
  });

  it("vincula todos os componentes de uma única despesa sem criar lançamento ou pagamento extra", async () => {
    await expect(vincularItem(cenario.fatura.id, 1, cenario.item.id, { lancamentos: selecionar() }, sessao)).resolves.toEqual({ ok: true });
    expect(cenario.item.lancamentos.map(l => l.id)).toEqual(["l1", "l2"]);
    expect(cenario.item.lancamentos.reduce((total, l) => total.plus(l.valor), decimal(0)).toFixed(2)).toBe("100.00");
    expect(cenario.tx.lancamentoFinanceiro.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["l1", "l2"] } }, data: { itemFaturaId: cenario.item.id } });
    expect(cenario.tx.lancamentoFinanceiro.create).not.toHaveBeenCalled();
    expect(cenario.tx.movimentacaoBancaria.create).not.toHaveBeenCalled();
    expect(fronteiras.auditar).toHaveBeenCalledOnce();
  });

  it("a criação de nova despesa reconhece a duplicidade pelo total agrupado da NF-e", async () => {
    await expect(vincularItem(cenario.fatura.id, 1, cenario.item.id, { criar: true }, sessao)).rejects.toThrow(/existe lançamento pendente correspondente/);
    esperarSemEscrita();
  });
});
