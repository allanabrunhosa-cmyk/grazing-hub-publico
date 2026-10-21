import "server-only";
import { horariosSnapshotIfood } from "@/lib/ifood/horarios-servidor";
import { entregaAtrasada, intervaloDatasPedidos } from "./pedidos-agenda-dominio";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pendenciasOperacao, type FatoOperacao } from "./pedidos-operacao-dominio";
import type { CoberturaPedido } from "./pedidos-composicao";

export type FiltroGestao = { clienteId?: string; canalId?: string; de?: string; ate?: string; base?: string; pagina?: number; paginaProdutos?: number };
const soma = (valores: Prisma.Decimal[]) => valores.reduce((s, v) => s.plus(v), new Prisma.Decimal(0));
const dinheiro = (v: Prisma.Decimal) => v.toFixed(2);
export async function consultarGestaoPedidos(filtro: FiltroGestao = {}) {
  const loja = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
  const fusoHorario = loja?.fusoHorario ?? "America/Sao_Paulo";
  const intervalo = intervaloDatasPedidos(filtro.de, filtro.ate, filtro.base, fusoHorario);
  const pagina = Number.isSafeInteger(filtro.pagina) && filtro.pagina! > 0 ? Math.min(filtro.pagina!, 10000) : 1;
  const where: Prisma.PedidoVendaWhereInput = { status: { in: ["CONFIRMADO", "CANCELADO"] }, ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}), ...(filtro.canalId ? { canalId: filtro.canalId } : {}) };
  if (Object.keys(intervalo).length) {
    if (filtro.base === "entrega") where.previsaoData = intervalo;
    else where.AND = [{ OR: [
      { dataCompra: intervaloDatasPedidos(filtro.de, filtro.ate, "entrega", fusoHorario) },
      { dataCompra: null, confirmadoEm: intervalo },
    ] }];
  }
  // Uma fotografia transacional das fontes evita totais de instantes diferentes.
  return prisma.$transaction(async tx => {
    const baseCliente: Prisma.PedidoVendaWhereInput = { ...where }, baseCanal: Prisma.PedidoVendaWhereInput = { ...where };
    delete baseCliente.clienteId; delete baseCanal.canalId;
    const [total, clientes, canais] = await Promise.all([
      tx.pedidoVenda.count({ where }),
      tx.pedidoVenda.groupBy({ by: ["clienteId"], where: baseCliente, _count: { _all: true } }),
      tx.pedidoVenda.groupBy({ by: ["canalId"], where: baseCanal, _count: { _all: true } }),
    ]);
    const contar = (grupos: { _count: { _all: number } }[]) => grupos.reduce((total, grupo) => total + grupo._count._all, 0);
    const contagensClientes: Record<string, number> = { "": contar(clientes), ...Object.fromEntries(clientes.filter(g => g.clienteId).map(g => [g.clienteId!, g._count._all])) };
    const contagensCanais: Record<string, number> = { "": contar(canais), ...Object.fromEntries(canais.filter(g => g.canalId).map(g => [g.canalId!, g._count._all])) };
    const pedidos = await tx.pedidoVenda.findMany({ where, skip: (pagina - 1) * 50, take: 50, orderBy: [{ confirmadoEm: "desc" }, { numero: "desc" }], include: { ifood: { select: { snapshotCifrado: true } }, itens: { where: { vigente: true } }, lancamentosFinanceiros: true, pagamentosExternos: { include: { repasses: true } }, tratamentosFinanceiros: true, historico: { where: { tipo: { startsWith: "OPERACAO_" } } } } });
    const linhas = pedidos.map(p => {
      const financeiro = (v: Prisma.Decimal) => p.modoFinanceiro === "EXTERNO" ? null : dinheiro(v);
      const titulos = p.lancamentosFinanceiros.filter(t => t.tipo === "RECEITA");
      const recebidos = soma(titulos.filter(t => t.status === "BAIXADO" && !t.pedidoQuitadoCredito).map(t => t.valor));
      const credito = soma(titulos.filter(t => t.status === "BAIXADO" && t.pedidoQuitadoCredito).map(t => t.valor));
      const capturas = p.pagamentosExternos.filter(e => e.status === "CAPTURADO");
      const capturado = soma(capturas.map(e => e.valorBruto));
      const repasses = p.pagamentosExternos.flatMap(e => e.repasses);
      const repassado = soma(repasses.map(r => r.valorBruto)), taxas = soma(repasses.map(r => r.taxa));
      const aRepassar = capturado.minus(repassado);
      const aReceber = soma(titulos.filter(t => t.status === "PENDENTE").map(t => t.valor)).minus(aRepassar);
      const concluidos = p.tratamentosFinanceiros.filter(t => t.status === "CONCLUIDA" && t.tipo === "DEVOLUCAO");
      const inicio = p.historico.find(h => h.tipo === "OPERACAO_INICIAR");
      const cobertura = (inicio?.antes as { cobertura?: CoberturaPedido } | null)?.cobertura;
      const custo = cobertura && p.itens.length === cobertura.itens.length && p.itens.every(i => cobertura.itens.some(c => c.itemId === i.id)) && cobertura.cobertura.total > 0 && cobertura.cobertura.comEstimativa === cobertura.cobertura.total ? soma(cobertura.itens.map(i => new Prisma.Decimal(i.custoEstimado!))) : null;
      const fatos = JSON.parse(JSON.stringify(p.historico)) as FatoOperacao[];
      const horariosIfood = horariosSnapshotIfood(p.ifood?.snapshotCifrado, p.fusoHorario);
      const limiteIfood = horariosIfood?.janelaFim ?? horariosIfood?.entregaRetirada;
      const comprador = p.compradorSnapshot as { nome?: string } | null;
      return { fusoHorario: p.fusoHorario, modoFinanceiro: p.modoFinanceiro, id: p.id, numero: p.numero, cliente: comprador?.nome ?? "Não informado", clienteId: p.clienteId, canal: p.canalNomeSnapshot, status: p.status, confirmadoEm: p.confirmadoEm?.toISOString() ?? null, previsaoData: p.previsaoData?.toISOString().slice(0, 10) ?? null, operacional: p.statusOperacional, atraso: p.status === "CONFIRMADO" && !p.entregueEm && (p.ifood ? !!limiteIfood && limiteIfood < new Date() : entregaAtrasada(p.previsaoData?.toISOString().slice(0, 10) ?? null, p.previsaoJanela, p.fusoHorario)), ocorrencias: pendenciasOperacao(fatos).length,
        comercial: dinheiro(p.total), desconto: dinheiro(p.desconto), frete: dinheiro(p.frete), recebidoBruto: financeiro(recebidos), entradaLiquida: financeiro(recebidos.minus(taxas)), creditoAplicado: financeiro(credito), capturado: financeiro(capturado), repassado: financeiro(repassado), aRepassar: financeiro(aRepassar), aReceber: financeiro(aReceber), taxas: financeiro(taxas), taxaPendente: capturas.some(c => c.taxa === null), devolvido: financeiro(soma(concluidos.map(t => t.valor))), retido: financeiro(soma(concluidos.map(t => t.retido))), devolucaoPendente: financeiro(soma(p.tratamentosFinanceiros.filter(t => t.tipo === "DEVOLUCAO" && ["SOLICITADA", "PROCESSANDO"].includes(t.status)).map(t => t.valor))), custoEstimado: custo ? dinheiro(custo) : null, custoApurado: null,
      };
    });
    const grupos = new Map<string, { produto: string; variacao: string; categorias: string; canal: string; unidade: string; quantidade: Prisma.Decimal; valor: Prisma.Decimal; desconto: Prisma.Decimal }>();
    // Agrupamento de toda a coorte, em lotes, independente da página de pedidos.
    let cursor: string | undefined;
    while (true) {
      const lote = await tx.pedidoVenda.findMany({ where: { ...where, status: "CONFIRMADO" }, orderBy: { id: "asc" }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, canalId: true, canalNomeSnapshot: true, itens: { where: { vigente: true }, select: { produtoId: true, produtoSnapshot: true, escolhasSnapshot: true, unidadeSnapshot: true, quantidade: true, totalLinha: true, desconto: true } } } });
      for (const p of lote) for (const i of p.itens) {
      const snapshot = i.produtoSnapshot as { nome: string; categorias: { nome: string }[]; complementoAvulso?: { grupoId: string; grupoNome: string; opcaoId: string; multiplicador: string; unidadeProduto: string } };
      const escolhas = i.escolhasSnapshot as { opcaoId: string; opcaoNome: string; quantidade: number }[];
      const categorias = snapshot.categorias.map(c => c.nome).sort().join(" / ") || "Sem categoria";
      const avulso = snapshot.complementoAvulso;
      const variacao = avulso ? `${avulso.grupoNome} · ${avulso.multiplicador} ${avulso.unidadeProduto} por unidade` : escolhas.map(e => `${e.quantidade} × ${e.opcaoNome}`).sort().join("; ") || "Padrão";
      const chave = JSON.stringify([i.produtoId, snapshot.nome, categorias, variacao, p.canalId, p.canalNomeSnapshot, i.unidadeSnapshot, ...(avulso ? [avulso.grupoId, avulso.opcaoId, avulso.multiplicador] : [])]);
      const grupo = grupos.get(chave) ?? { produto: snapshot.nome, variacao, categorias, unidade: i.unidadeSnapshot, canal: p.canalNomeSnapshot ?? "Não informado", quantidade: new Prisma.Decimal(0), valor: new Prisma.Decimal(0), desconto: new Prisma.Decimal(0) };
      grupo.quantidade = grupo.quantidade.plus(i.quantidade); grupo.valor = grupo.valor.plus(i.totalLinha); grupo.desconto = grupo.desconto.plus(i.desconto); grupos.set(chave, grupo);
      }
      if (lote.length < 500) break;
      cursor = lote[lote.length - 1].id;
    }
    const paginaProdutos = Number.isSafeInteger(filtro.paginaProdutos) && filtro.paginaProdutos! > 0 ? Math.min(filtro.paginaProdutos!, 10000) : 1;
    const agrupados = [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
    return { contagensClientes, contagensCanais, fusoHorario, pagina, paginas: Math.ceil(total / 50), total, geradoEm: new Date().toISOString(), linhas, paginaProdutos, paginasProdutos: Math.ceil(agrupados.length / 50), totalGrupos: agrupados.length, valorItensAtivos: dinheiro(soma(agrupados.map(g => g.valor))), produtos: agrupados.slice((paginaProdutos - 1) * 50, paginaProdutos * 50).map(g => ({ ...g, quantidade: g.quantidade.toString(), valor: dinheiro(g.valor), desconto: dinheiro(g.desconto) })) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}
