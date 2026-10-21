import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { EnderecoVenda, EntregaPadraoCliente } from "./dominio";
import type { ClienteConsulta, CreditoClienteConsulta, HistoricoPedidosCliente, ResumoPedidosCliente } from "@/app/(protegido)/vendas/clientes/tipos";
import { ehPedidoHistorico, ORIGEM_HISTORICA } from "./historico-dominio";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";
import { identificadoresAlternativosCliente } from "./cliente-identificadores";

/** Somente a FK efetivamente gravada resolve alias; contato compartilhado não prova fusão. */
export async function consultarDestinoClienteUnificado(clienteId: string): Promise<string | null> {
  if (!entidadeInicial(clienteId)) return null;
  const cliente = await prisma.clienteVenda.findUnique({ where: { id: clienteId }, select: { unificadoEmId: true } });
  return cliente?.unificadoEmId ?? null;
}

export async function consultarClientesVenda({ verPedidos, verCredito }: { verPedidos: boolean; verCredito: boolean }) {
  const [registros, formasPagamento, agregados, historicos, loja, compras] = await Promise.all([
    prisma.clienteVenda.findMany({ where: { unificadoEmId: null }, orderBy: [{ nome: "asc" }, { id: "asc" }], select: {
      id: true, versao: true, nome: true, primeiroNome: true, sobrenome: true, razaoSocial: true,
      inscricaoEstadual: true, dataNascimento: true, tipo: true, documento: true, email: true, telefone: true,
      contato: true, nomeContato: true, sobrenomeContato: true, observacoes: true, enderecos: true, entregaPadrao: true, ativo: true,
      formasPagamentoHabilitadas: true, boletoDiasAposEntrega: true, limiteCreditoAberto: true,
      contatosEmpresa: { where: { ativo: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, primeiroNome: true, sobrenome: true, email: true, telefone: true } },
      clientesUnificados: { select: { email: true, tipo: true, documento: true, enderecos: true, contatosEmpresa: { where: { ativo: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, primeiroNome: true, sobrenome: true, email: true, telefone: true } } } },
    } }),
    prisma.formaPagamentoVenda.findMany({ orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, tipo: true, ativo: true } }),
    verPedidos ? prisma.pedidoVenda.groupBy({
      by: ["clienteId"], where: { clienteId: { not: null }, status: "CONFIRMADO", dataCompra: null },
      _count: { _all: true }, _sum: { total: true }, _max: { confirmadoEm: true },
    }) : Promise.resolve([]),
    verPedidos ? prisma.pedidoVenda.groupBy({
      by: ["clienteId"], where: { clienteId: { not: null }, status: "HISTORICO", OR: [
        { origem: "HISTORICO_LEGADO" }, { referenciaOrigem: ORIGEM_HISTORICA },
      ] },
      _count: { _all: true }, _sum: { total: true }, _max: { createdAt: true },
    }) : Promise.resolve([]),
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } }),
    verPedidos ? prisma.pedidoVenda.groupBy({
      by: ["clienteId"], where: { clienteId: { not: null }, status: "CONFIRMADO", dataCompra: { not: null } },
      _count: { _all: true }, _sum: { total: true }, _max: { dataCompra: true },
    }) : Promise.resolve([]),
  ]);
  const resumos = new Map<string, ResumoPedidosCliente>();
  for (const p of agregados) if (p.clienteId) resumos.set(p.clienteId, {
    ultimoPedido: p._max.confirmadoEm?.toISOString() ?? null,
    quantidadePedidos: p._count._all,
    valorTotalGasto: p._sum.total?.toFixed(2) ?? "0.00",
  });
  for (const p of compras) if (p.clienteId) {
    const atual = resumos.get(p.clienteId), dataCompra = p._max.dataCompra?.toISOString().slice(0, 10) ?? null;
    resumos.set(p.clienteId, {
      ultimoPedido: atual?.ultimoPedido && (!dataCompra || atual.ultimoPedido.slice(0, 10) > dataCompra) ? atual.ultimoPedido : dataCompra,
      quantidadePedidos: (atual?.quantidadePedidos ?? 0) + p._count._all,
      valorTotalGasto: new Prisma.Decimal(atual?.valorTotalGasto ?? 0).plus(p._sum.total ?? 0).toFixed(2),
    });
  }
  for (const p of historicos) if (p.clienteId) {
    const atual = resumos.get(p.clienteId);
    const dataHistorica = p._max.createdAt?.toISOString() ?? null;
    resumos.set(p.clienteId, {
      ultimoPedido: atual?.ultimoPedido && (!dataHistorica || atual.ultimoPedido > dataHistorica) ? atual.ultimoPedido : dataHistorica,
      quantidadePedidos: (atual?.quantidadePedidos ?? 0) + p._count._all,
      valorTotalGasto: new Prisma.Decimal(atual?.valorTotalGasto ?? 0).plus(p._sum.total ?? 0).toFixed(2),
    });
  }
  const movimentos = verCredito && registros.length ? await prisma.creditoClienteMovimento.findMany({
    where: { clienteId: { in: registros.map(c => c.id) } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, clienteId: true, tipo: true, valor: true, data: true, pedidoAplicacao: { select: { numero: true } }, tratamento: { select: { pedido: { select: { numero: true } } } }, motivo: true, referenciaComunicacao: true },
  }) : [];
  const creditos: Record<string, CreditoClienteConsulta> = {};
  const saldos = new Map<string, Prisma.Decimal>();
  for (const m of movimentos) {
    const carteira = creditos[m.clienteId] ?? { saldo: 0, movimentos: [] };
    const saldo = saldos.get(m.clienteId) ?? new Prisma.Decimal(0);
    const novoSaldo = ["CONCESSAO", "LIBERACAO", "AJUSTE_CREDITO"].includes(m.tipo) ? saldo.plus(m.valor) : saldo.minus(m.valor);
    saldos.set(m.clienteId, novoSaldo);
    carteira.saldo = Number(novoSaldo.toFixed(2));
    carteira.movimentos.push({ id: m.id, tipo: m.tipo, valor: Number(m.valor.toFixed(2)), data: m.data.toISOString(), pedidoNumero: m.pedidoAplicacao?.numero ?? m.tratamento?.pedido.numero ?? null, motivo: m.motivo, referenciaComunicacao: m.referenciaComunicacao });
    creditos[m.clienteId] = carteira;
  }
  const clientes: ClienteConsulta[] = registros.map(c => ({
    id: c.id, versao: c.versao, nome: c.nome, tipo: c.tipo as "PF" | "PJ", documento: c.documento,
    primeiroNome: c.primeiroNome, sobrenome: c.sobrenome, razaoSocial: c.razaoSocial,
    inscricaoEstadual: c.inscricaoEstadual, dataNascimento: c.dataNascimento?.toISOString().slice(0, 10) ?? null,
    email: c.email, telefone: c.telefone, contato: c.contato, nomeContato: c.nomeContato, sobrenomeContato: c.sobrenomeContato, observacoes: c.observacoes,
    ...identificadoresAlternativosCliente(c.clientesUnificados ?? []),
    enderecos: c.enderecos as EnderecoVenda[], entregaPadrao: c.entregaPadrao as EntregaPadraoCliente | null, ativo: c.ativo,
    contatosEmpresa: [...(c.contatosEmpresa ?? []), ...(c.clientesUnificados ?? []).flatMap(origem => origem.contatosEmpresa ?? [])],
    regrasPagamento: {
      formasPagamentoIds: Array.isArray(c.formasPagamentoHabilitadas) ? c.formasPagamentoHabilitadas.filter((id): id is string => typeof id === "string") : null,
      boletoDiasAposEntrega: c.boletoDiasAposEntrega,
      limiteCreditoAberto: c.limiteCreditoAberto?.toFixed(2) ?? null,
    },
    resumoPedidos: verPedidos ? resumos.get(c.id) ?? { ultimoPedido: null, quantidadePedidos: 0, valorTotalGasto: "0.00" } : null,
  }));
  return { clientes, formasPagamento, creditos: verCredito ? creditos : null, fusoHorario: loja?.fusoHorario ?? "America/Sao_Paulo" };
}

export async function consultarHistoricoPedidosCliente(clienteId: string, pagina = 1): Promise<HistoricoPedidosCliente> {
  const tamanhoPagina = 25;
  const where = { clienteId, status: { not: "RASCUNHO" } };
  const total = await prisma.pedidoVenda.count({ where });
  const paginaAtual = Math.min(Math.max(1, Math.ceil(total / tamanhoPagina)), Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1);
  // A ordenação ocorre antes da paginação. NULL confirmadoEm dos históricos não
  // pode colocá-los antes de pedidos recentes nem inverter seus números internos.
  const historico = Prisma.sql`("origem" = 'HISTORICO_LEGADO' OR "referenciaOrigem" = ${ORIGEM_HISTORICA})`;
  const pedidos = await prisma.$queryRaw<(Prisma.PedidoVendaGetPayload<{ select: {
    id: true; numero: true; origem: true; referenciaOrigem: true; referenciaPedido: true;
    status: true; previsaoData: true; previsaoJanela: true; entregueEm: true; fusoHorario: true; total: true;
  } }> & { dataPedido: Date; baseDataPedido: "COMPRA" | "CRIACAO_HISTORICA" | "CONFIRMACAO" | "CRIACAO" })[]>(Prisma.sql`
    SELECT "id", "numero", "origem", "referenciaOrigem", "referenciaPedido", "status",
      "previsaoData", "previsaoJanela", "entregueEm", "fusoHorario", "total",
      CASE WHEN "dataCompra" IS NOT NULL THEN "dataCompra"::timestamp WHEN ${historico} THEN "createdAt" ELSE COALESCE("confirmadoEm", "createdAt") END AS "dataPedido",
      CASE WHEN "dataCompra" IS NOT NULL THEN 'COMPRA' WHEN ${historico} THEN 'CRIACAO_HISTORICA' WHEN "confirmadoEm" IS NOT NULL THEN 'CONFIRMACAO' ELSE 'CRIACAO' END AS "baseDataPedido"
    FROM "PedidoVenda" WHERE "clienteId" = ${clienteId} AND "status" <> 'RASCUNHO'
    ORDER BY "dataPedido" DESC, "id" DESC
    LIMIT ${tamanhoPagina} OFFSET ${(paginaAtual - 1) * tamanhoPagina}`);
  return { total, pagina: paginaAtual, tamanhoPagina, pedidos: pedidos.map(p => ({
    id: p.id, numero: ehPedidoHistorico(p) && p.referenciaPedido ? Number(p.referenciaPedido) : p.numero, status: p.status, previsaoData: p.previsaoData?.toISOString().slice(0, 10) ?? null,
    previsaoJanela: p.previsaoJanela, entregueEm: p.entregueEm?.toISOString() ?? null,
    dataPedido: p.baseDataPedido === "COMPRA" ? p.dataPedido.toISOString().slice(0, 10) : p.dataPedido.toISOString(), baseDataPedido: p.baseDataPedido,
    fusoHorario: p.fusoHorario, total: p.total.toFixed(2),
  })) };
}
