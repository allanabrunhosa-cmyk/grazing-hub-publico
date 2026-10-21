import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { assinaturaEntradas } from "./entregas-recibo";
import { autorEntregas } from "./entregas";
import { exigirEfeitoOperacional } from "@/lib/ifood/acompanhamento";
import { conferirAcesso } from "./pedidos";
import { ErroPedidoVenda, dinheiro } from "./pedidos-dominio";
import type { SessaoAtual } from "@/lib/session";
import { travarCustosEntrega } from "@/lib/financeiro/custos-entrega";
export async function salvarCustoEntrega(id: string, versao: number, estimado: string | null, efetivo: string | null, prestador: string | null, motivo: string, chave: string, sessao: SessaoAtual) {
  if (!id || id.length > 100 || !Number.isSafeInteger(versao) || versao < 1 || !motivo.trim() || motivo.length > 1000 || !/^[a-zA-Z0-9_-]{16,100}$/.test(chave) || (prestador && prestador.length > 100)) throw new ErroPedidoVenda("Informe dados válidos e justificativa dos custos.");
  const custo = (v: string | null) => v == null || v === "" ? null : new Prisma.Decimal(dinheiro(v, "Custo da entrega"));
  const custos = { custoEntregaEstimado: custo(estimado), custoEntregaEfetivo: custo(efetivo), prestadorEntregaId: prestador || null };
  const hash = assinaturaEntradas({ id, versao, custos, motivo });
  return prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["consultar"]);
    await exigirEfeitoOperacional(tx, id);
    const autor = await autorEntregas(tx, sessao, "vendas.pedidos.logistica");
    await travarCustosEntrega(tx);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pedido-operacao:${chave}`}))`;
    const evento = await tx.historicoPedidoVenda.findUnique({ where: { chaveOperacao: chave } });
    if (evento) { if (evento.pedidoId !== id || evento.hashOperacao !== hash) throw new ErroPedidoVenda("Operação já usada com outros dados."); return { versao: evento.versaoNova }; }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const p = await tx.pedidoVenda.findUnique({ where: { id } });
    if (!p || p.versao !== versao || p.atendimento !== "ENTREGA" || !["CONFIRMADO", "CANCELADO", "ESTORNADO"].includes(p.status)) throw new ErroPedidoVenda("Reabra um pedido de entrega confirmado antes de registrar custos.");
    if (prestador && !await tx.fornecedor.findUnique({ where: { id: prestador } })) throw new ErroPedidoVenda("Prestador não encontrado.");
    const vinculado = await tx.vinculoCustoEntrega.aggregate({ where: { pedidoId: id, desvinculadoEm: null }, _sum: { valor: true } });
    if (vinculado._sum.valor?.gt(custos.custoEntregaEfetivo ?? 0)) throw new ErroPedidoVenda("Desvincule as despesas antes de reduzir o custo efetivo abaixo do valor vinculado.");
    const fotografar = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
    await tx.pedidoVenda.update({ where: { id }, data: { ...custos, versao: { increment: 1 } } });
    await tx.historicoPedidoVenda.create({ data: { pedidoId: id, tipo: "CUSTO_ENTREGA", chaveOperacao: chave, hashOperacao: hash, usuarioId: autor.userId, usuarioNome: autor.nome, motivo: motivo.trim(), versaoAnterior: versao, versaoNova: versao + 1, antes: fotografar({ custoEntregaEstimado: p.custoEntregaEstimado, custoEntregaEfetivo: p.custoEntregaEfetivo, prestadorEntregaId: p.prestadorEntregaId }), depois: fotografar(custos) } });
    return { versao: versao + 1 };
  });
}

export async function buscarDespesasEntrega(busca: string, sessao: SessaoAtual) {
  if (typeof busca !== "string" || busca.trim().length < 2 || busca.length > 120) return [];
  return prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["consultar", "condicao"]);
    await autorEntregas(tx, sessao, "vendas.pedidos.logistica");
    const titulos = await tx.lancamentoFinanceiro.findMany({ where: { tipo: "DESPESA", status: { not: "CANCELADO" }, pedidoVendaId: null, OR: [{ descricao: { contains: busca.trim(), mode: "insensitive" } }, { fornecedor: { nome: { contains: busca.trim(), mode: "insensitive" } } }] }, include: { categoria: { select: { nome: true } }, custosEntrega: { where: { desvinculadoEm: null }, select: { valor: true } } }, orderBy: { dataCompetencia: "desc" }, take: 50 });
    return titulos.map(t => ({ id: t.id, descricao: t.descricao, categoria: t.categoria.nome, status: t.status, valor: t.valor.toString(), disponivel: t.custosEntrega.reduce((s, c) => s.minus(c.valor), t.valor).toString(), revisao: t.updatedAt.toISOString(), competencia: t.dataCompetencia.toISOString() }));
  });
}
export async function vincularDespesaEntrega(d: { pedidoId: string; versao: number; lancamentoId: string; revisao: string; valor: string; motivo: string; chave: string }, sessao: SessaoAtual) {
  if (!d || !/^[a-zA-Z0-9_-]{1,100}$/.test(d.pedidoId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(d.lancamentoId) || !Number.isSafeInteger(d.versao) || !d.motivo?.trim() || d.motivo.length > 1000 || !/^[a-zA-Z0-9_-]{16,100}$/.test(d.chave)) throw new ErroPedidoVenda("Informe despesa, valor e justificativa válidos.");
  const valor = new Prisma.Decimal(dinheiro(d.valor, "Valor do custo vinculado")); if (!valor.gt(0)) throw new ErroPedidoVenda("O valor vinculado deve ser positivo.");
  const hash = assinaturaEntradas(d);
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "condicao"], d.pedidoId); await autorEntregas(tx, sessao, "vendas.pedidos.logistica");
    await travarCustosEntrega(tx);
    const anterior = await tx.historicoPedidoVenda.findUnique({ where: { chaveOperacao: d.chave } });
    if (anterior) { if (anterior.hashOperacao !== hash || anterior.usuarioId !== autor.userId) throw new ErroPedidoVenda("Operação já usada com outros dados."); return { id: d.pedidoId }; }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${d.pedidoId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "LancamentoFinanceiro" WHERE id=${d.lancamentoId} FOR UPDATE`;
    const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId }, include: { custosFinanceirosEntrega: { where: { desvinculadoEm: null } } } });
    const l = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: d.lancamentoId }, include: { custosEntrega: { where: { desvinculadoEm: null } }, categoria: true } });
    if (p.versao !== d.versao || p.atendimento !== "ENTREGA" || p.status === "RASCUNHO" || p.custoEntregaEfetivo == null) throw new ErroPedidoVenda("Reabra o pedido e registre o custo efetivo antes de vincular.");
    if (l.tipo !== "DESPESA" || l.status === "CANCELADO" || l.pedidoVendaId || l.updatedAt.toISOString() !== d.revisao) throw new ErroPedidoVenda("Despesa alterada ou indisponível. Busque novamente.");
    if (l.custosEntrega.reduce((s, c) => s.plus(c.valor), valor).gt(l.valor)) throw new ErroPedidoVenda("O valor supera o saldo da despesa disponível para vincular.");
    if (p.custosFinanceirosEntrega.reduce((s, c) => s.plus(c.valor), valor).gt(p.custoEntregaEfetivo)) throw new ErroPedidoVenda("O valor supera o custo efetivo ainda sem vínculo financeiro.");
    const v = await tx.vinculoCustoEntrega.create({ data: { pedidoId: p.id, lancamentoId: l.id, valor, criadoPorId: autor.userId, snapshot: { descricao: l.descricao, valor: l.valor.toString(), categoriaId: l.categoriaId, categoria: l.categoria.nome, competencia: l.dataCompetencia.toISOString(), status: l.status } } });
    await tx.pedidoVenda.update({ where: { id: p.id }, data: { versao: { increment: 1 } } });
    await tx.historicoPedidoVenda.create({ data: { pedidoId: p.id, tipo: "DESPESA_ENTREGA_VINCULADA", chaveOperacao: d.chave, hashOperacao: hash, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: p.versao, versaoNova: p.versao + 1, motivo: d.motivo.trim(), depois: { vinculoId: v.id, lancamentoId: l.id, valor: valor.toString() } } });
    return { id: p.id };
  });
}
export async function desvincularDespesaEntrega(id: string, motivo: string, chave: string, sessao: SessaoAtual) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !motivo?.trim() || motivo.length > 1000 || !/^[a-zA-Z0-9_-]{16,100}$/.test(chave)) throw new ErroPedidoVenda("Informe vínculo e justificativa válidos.");
  const hash = assinaturaEntradas({ id, motivo });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "condicao"]); await autorEntregas(tx, sessao, "vendas.pedidos.logistica"); await travarCustosEntrega(tx);
    const anterior = await tx.historicoPedidoVenda.findUnique({ where: { chaveOperacao: chave } });
    if (anterior) { if (anterior.hashOperacao !== hash || anterior.usuarioId !== autor.userId) throw new ErroPedidoVenda("Operação já usada com outros dados."); return; }
    const v = await tx.vinculoCustoEntrega.findUniqueOrThrow({ where: { id } }); if (v.desvinculadoEm) throw new ErroPedidoVenda("Vínculo já removido.");
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${v.pedidoId} FOR UPDATE`;
    const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: v.pedidoId } });
    await exigirEfeitoOperacional(tx, p.id);
    await tx.vinculoCustoEntrega.update({ where: { id }, data: { desvinculadoEm: new Date() } });
    await tx.pedidoVenda.update({ where: { id: p.id }, data: { versao: { increment: 1 } } });
    await tx.historicoPedidoVenda.create({ data: { pedidoId: p.id, tipo: "DESPESA_ENTREGA_DESVINCULADA", chaveOperacao: chave, hashOperacao: hash, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: p.versao, versaoNova: p.versao + 1, motivo: motivo.trim(), depois: { vinculoId: id, lancamentoId: v.lancamentoId, valor: v.valor.toString() } } });
  });
}
