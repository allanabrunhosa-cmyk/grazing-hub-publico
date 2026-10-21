import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";

const sim = vi.hoisted(() => ({
  listar: vi.fn(), contar: vi.fn(), total: vi.fn(), agrupar: vi.fn(), loja: vi.fn(), ids: vi.fn(),
  clientes: vi.fn(), produtos: vi.fn(), opcoes: vi.fn(), canais: vi.fn(), formas: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  pedidoVenda: { findMany: sim.listar, count: sim.contar, aggregate: sim.total, groupBy: sim.agrupar },
  configuracaoLoja: { findUnique: sim.loja }, $queryRaw: sim.ids,
  clienteVenda: { findMany: sim.clientes }, produtoVenda: { findMany: sim.produtos },
  opcaoComplementoVenda: { findMany: sim.opcoes }, canalVenda: { findMany: sim.canais },
  formaPagamentoVenda: { findMany: sim.formas },
} }));
import { exigirEfeitoOperacional } from "@/lib/ifood/acompanhamento";
import { BLOQUEIO_ACOMPANHAMENTO_IFOOD } from "@/lib/ifood/acompanhamento-dominio";
import { conferirAcesso, listarPedidos, type FiltroPedidos } from "@/lib/vendas/pedidos";
import { consultarGestorPedidos } from "@/lib/vendas/pedidos-gestor";
import { ORIGEM_HISTORICA } from "@/lib/vendas/historico-dominio";

function pedido(historico: boolean) {
  return {
    id: historico ? "historico-sintetico" : "operacional-sintetico", numero: historico ? -22851 : 7,
    origem: historico ? "HISTORICO_LEGADO" : "INTERNO", referenciaOrigem: historico ? ORIGEM_HISTORICA : null,
    referenciaPedido: historico ? "22851" : null, status: historico ? "HISTORICO" : "CONFIRMADO",
    statusOperacional: "PENDENTE", modoFinanceiro: "EXTERNO", versao: 1, clienteId: null,
    fusoHorario: "America/Sao_Paulo", atendimento: null, prazo: null, rascunho: null,
    dataCompra: null, previsaoData: null, previsaoJanela: null, createdAt: new Date("2026-08-01T15:00:00Z"),
    confirmadoEm: new Date("2026-08-01T15:00:00Z"), entregueEm: null, ifood: null,
    compradorSnapshot: { nome: "Comprador sintético", dadosOrigem: "DADO_RESTRITO_NAO_SERIALIZAR" },
    pagamentoInformadoSnapshot: null, cobrancaSnapshot: null, destinatarioSnapshot: null, enderecoSnapshot: null,
    canalNomeSnapshot: "Legado sintético", formaPagamentoInformada: null, observacoes: "Registro sintético",
    subtotal: new Prisma.Decimal("2197.00"), total: new Prisma.Decimal("2219.00"),
    frete: new Prisma.Decimal("22.00"), desconto: new Prisma.Decimal(0), outrosCustos: new Prisma.Decimal(0),
    historico: [], itens: [],
  };
}

type Where = Record<string, unknown>;
function corresponde(registro: Record<string, unknown>, where: Where): boolean {
  for (const [campo, regra] of Object.entries(where)) {
    if (campo === "AND") {
      if (!(Array.isArray(regra) ? regra : [regra]).every(r => corresponde(registro, r as Where))) return false;
    } else if (campo === "OR") {
      if (!(regra as Where[]).some(r => corresponde(registro, r))) return false;
    } else if (campo === "NOT") {
      if ((Array.isArray(regra) ? regra : [regra]).some(r => corresponde(registro, r as Where))) return false;
    } else if (regra && typeof regra === "object" && !(regra instanceof Date)) {
      const operacao = regra as { in?: unknown[]; not?: unknown; contains?: string; gte?: Date; lt?: Date };
      if (operacao.gte || operacao.lt) {
        const valor = registro[campo];
        if (!(valor instanceof Date) || operacao.gte && valor < operacao.gte || operacao.lt && valor >= operacao.lt) return false;
        continue;
      }
      if (operacao.in && !operacao.in.includes(registro[campo])) return false;
      if (Object.hasOwn(operacao, "not") && registro[campo] === operacao.not) return false;
      if (operacao.contains !== undefined && !String(registro[campo] ?? "").includes(operacao.contains)) return false;
      if (!["in", "not", "contains"].some(chave => Object.hasOwn(operacao, chave))) {
        const valor = registro[campo];
        if (!valor || typeof valor !== "object" || !corresponde(valor as Where, regra as Where)) return false;
      }
    } else if (registro[campo] !== regra) return false;
  }
  return true;
}

function transacao(p: ReturnType<typeof pedido> | null, acompanhamento = false) {
  const mocks = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    usuario: { findUnique: vi.fn().mockResolvedValue({
      id: "operador-sintetico", nome: "Operador sintético", ativo: true, excluidoEm: null,
      sessaoVersao: 0, permissoesPersonalizadas: {}, perfilAcesso: { sistema: "ADMINISTRADOR", permissoes: {} },
    }) },
    pedidoVenda: { findUnique: vi.fn().mockResolvedValue(p) },
    pedidoIfood: { findUnique: vi.fn().mockResolvedValue(acompanhamento ? { acompanhamento: true } : null) },
    configuracaoLoja: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  return { mocks, tx: mocks as unknown as Prisma.TransactionClient };
}
const sessao = { userId: "operador-sintetico", nome: "Operador sintético", versao: 0 } as SessaoAtual;

beforeEach(() => {
  const registros = [pedido(true), pedido(false)];
  sim.listar.mockImplementation(({ where }: { where: Where }) => Promise.resolve(registros.filter(r => corresponde(r, where))));
  sim.contar.mockImplementation(({ where }: { where: Where }) => Promise.resolve(registros.filter(r => corresponde(r, where)).length));
  sim.total.mockResolvedValue({ _count: { id: 0 }, _sum: { total: null } });
  sim.agrupar.mockResolvedValue([]);
  sim.loja.mockResolvedValue({ fusoHorario: "America/Sao_Paulo" });
  sim.ids.mockResolvedValue([]);
  for (const mock of [sim.clientes, sim.produtos, sim.opcoes, sim.canais, sim.formas]) mock.mockResolvedValue([]);
});

describe("Proteção de pedidos históricos", () => {
  it("bloqueia efeitos pela identidade histórica antes de consultar integrações", async () => {
    const { tx, mocks } = transacao(pedido(true));
    await expect(exigirEfeitoOperacional(tx, "historico-sintetico")).rejects.toThrow("somente leitura");
    expect(mocks.pedidoIfood.findUnique).not.toHaveBeenCalled();
  });

  it("mantém a proteção se o status comercial do legado for alterado", async () => {
    const p = { ...pedido(true), status: "CONFIRMADO" };
    await expect(exigirEfeitoOperacional(transacao(p).tx, p.id)).rejects.toThrow("somente leitura");
  });

  it.each([
    { origem: "HISTORICO_LEGADO", referenciaOrigem: null },
    { origem: "INTERNO", referenciaOrigem: ORIGEM_HISTORICA },
  ])("reconhece os marcadores independentes %j sem depender do status", async identidade => {
    const p = { ...pedido(true), ...identidade, status: "CONFIRMADO" };
    await expect(exigirEfeitoOperacional(transacao(p).tx, p.id)).rejects.toThrow("somente leitura");
  });

  it.each([
    "rascunho", "confirmar", "revisar", "desconto", "preco", "cancelar", "receber", "estornar",
    "condicao", "estoque", "fiscal", "operar", "cliente", "editarCliente", "horarios",
  ] as const)("impede a capacidade %s no legado mesmo para administrador", async capacidade => {
    const { tx, mocks } = transacao(pedido(true));
    await expect(conferirAcesso(tx, sessao, [capacidade], "historico-sintetico")).rejects.toThrow("somente leitura");
    expect(mocks.configuracaoLoja.findUnique).not.toHaveBeenCalled();
  });

  it("preserva consulta autenticada ao legado e não executa a barreira de mutação", async () => {
    const { tx, mocks } = transacao(pedido(true));
    await expect(conferirAcesso(tx, sessao, ["consultar"], "historico-sintetico")).resolves.toEqual({ userId: sessao.userId, nome: sessao.nome });
    expect(mocks.pedidoVenda.findUnique).not.toHaveBeenCalled();
    expect(mocks.pedidoIfood.findUnique).not.toHaveBeenCalled();
  });

  it("conserva o bloqueio iFood e permite pedido operacional comum", async () => {
    const atual = pedido(false);
    await expect(exigirEfeitoOperacional(transacao(atual, true).tx, atual.id)).rejects.toThrow(BLOQUEIO_ACOMPANHAMENTO_IFOOD);
    await expect(exigirEfeitoOperacional(transacao(atual).tx, atual.id)).resolves.toBeUndefined();
  });

  it.each([
    { operacional: "PENDENTE" }, { etapaGestor: "novo" }, { etapaGestor: "preparo" },
    { status: "operacionais" }, { status: "operacionais", operacional: "PENDENTE" },
  ] satisfies FiltroPedidos[])("retira o legado da fila %j antes da contagem e paginação", async filtro => {
    const resultado = await listarPedidos(filtro);
    expect(resultado.pedidos.map(p => p.id)).not.toContain("historico-sintetico");
    const consulta = sim.listar.mock.calls[0][0];
    expect(corresponde(pedido(true), consulta.where)).toBe(false);
    expect(sim.contar).toHaveBeenCalledWith({ where: consulta.where });
  });

  it("mantém o número legado pesquisável sem expor campos extras dos snapshots", async () => {
    const resultado = await listarPedidos({ busca: "22851" });
    expect(resultado.pedidos).toHaveLength(1);
    expect(resultado.pedidos[0]).toMatchObject({ id: "historico-sintetico", numero: 22851, referenciaPedido: "22851", total: "2219" });
    expect(JSON.stringify(resultado)).not.toContain("DADO_RESTRITO_NAO_SERIALIZAR");
    const consulta = sim.listar.mock.calls[0][0];
    expect(consulta.where.OR).toContainEqual({ referenciaPedido: { contains: "22851", mode: "insensitive" } });
  });

  it("consulta o arquivo histórico pelo número original e pela criação, sem usar confirmação", async () => {
    const resultado = await listarPedidos({ status: "HISTORICO", busca: "22851", de: "2026-08-01", ate: "2026-08-31" });
    const where = sim.listar.mock.calls[0][0].where;
    expect(where.status).toBe("HISTORICO");
    expect(where.AND).toEqual([{ OR: [
      { dataCompra: { gte: new Date("2026-08-01T00:00:00Z"), lt: new Date("2026-09-01T00:00:00Z") } },
      { dataCompra: null, createdAt: { gte: new Date("2026-08-01T03:00:00Z"), lt: new Date("2026-09-01T03:00:00Z") } },
    ] }]);
    expect(JSON.stringify(where)).not.toContain("confirmadoEm");
    expect(resultado.pedidos).toHaveLength(1);
    expect(resultado.pedidos[0]).toMatchObject({ id: "historico-sintetico", numero: 22851, referenciaPedido: "22851" });
  });

  it("protege a fila quando a referência da origem está incompleta", async () => {
    await listarPedidos({ operacional: "PENDENTE" });
    const consulta = sim.listar.mock.calls[0][0];
    expect(corresponde({ ...pedido(true), status: "CONFIRMADO", referenciaOrigem: null }, consulta.where)).toBe(false);
  });

  it("exclui o estado HISTORICO da consulta operacional antiga do Gestor", async () => {
    const resultado = await consultarGestorPedidos();
    expect(resultado.pedidos.map(p => p.id)).toEqual(["operacional-sintetico"]);
    const consulta = sim.listar.mock.calls[0][0];
    expect(consulta.where.status.in).not.toContain("HISTORICO");
  });
});
