import { acompanhamentoDoPedido, exigirEfeitoOperacional } from "./acompanhamento";
import "server-only";
import { solicitarDevolucaoCancelamentoIfood } from "@/lib/vendas/pedidos";
import { Prisma } from "@/generated/prisma/client";
import { ErroIfood, objeto } from "./dominio";
import type { PedidoAdaptado } from "./adaptador";
import { validarFinanceiroConfigIfood, vencimentoPrevistoIfood } from "./financeiro-config";
import { diaNoFuso } from "@/lib/vendas/pedidos-agenda-dominio";

export function obrigacoesFinanceirasIfood(remoto: PedidoAdaptado) {
  const v = remoto.valores;
  if (v.problemas.length) return { metodos: [], pendencia: v.problemas.join("; ") };
  if (remoto.entregaPor === "IFOOD" && new Prisma.Decimal(remoto.dados.frete).gt(0)) return { metodos: [], pendencia: "Frete com entrega iFood: obrigação da loja não determinada pelo Order; conferir na carteira" };
  const taxas = new Prisma.Decimal(v.taxasIfood), subsidio = new Prisma.Decimal(v.patrocinioIfood);
  if (taxas.gt(0)) {
    if (!remoto.metodos.length || remoto.metodos.some(m => !m.prePago)) return { metodos: [], pendencia: "Taxa iFood com cobrança na entrega: conferir distribuição da cobrança antes de lançar receita" };
    const quantia = new Prisma.Decimal(remoto.dados.total).minus(taxas).plus(subsidio);
    if (quantia.lt(0)) return { metodos: [], pendencia: "Obrigação financeira negativa; conferir valores oficiais" };
    return { metodos: [{ ...remoto.metodos[0], valor: quantia.toFixed(2), metodo: "IFOOD_ONLINE", bandeira: null, trocoPara: null }], pendencia: null };
  }
  return { metodos: [...remoto.metodos, ...(subsidio.gt(0) ? [{ indice: remoto.metodos.length, valor: subsidio.toFixed(2), metodo: "SUBSIDIO_IFOOD", tipo: "ONLINE", prePago: true, recebedor: "IFOOD", bandeira: null, trocoPara: null }] : [])], pendencia: null };
}

/** A mesma carteira do HUB. Nunca representa repasse/baixa bancária ou comissão estimada. */
export async function projetarFinanceiro(tx: Prisma.TransactionClient, pedidoId: string, remoto: PedidoAdaptado, cancelado: boolean) {
  if (await acompanhamentoDoPedido(tx, pedidoId)) return null;
  const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, include: { canal: true } });
  const titulos = await tx.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedidoId } });
  if (cancelado) {
    // Preservar baixas, conciliações e capturas. Excedentes exigem ajuste evidenciado no HUB.
    await tx.lancamentoFinanceiro.updateMany({ where: { pedidoVendaId: pedidoId, status: "PENDENTE" }, data: { status: "CANCELADO" } });
    const recebido = titulos.some(t => t.status === "BAIXADO") || await tx.repassePagamentoPedido.count({ where: { pagamento: { pedidoId } } }) > 0;
    await tx.pagamentoExternoPedido.updateMany({ where: { pedidoId, status: "CAPTURADO", repassadoEm: null, repasses: { none: {} } }, data: { status: "CANCELADO_EXTERNAMENTE" } });
    if (recebido) {
      const loja = await tx.pedidoIfood.findUniqueOrThrow({ where: { pedidoId }, include: { loja: { include: { integracao: true } } } });
      await solicitarDevolucaoCancelamentoIfood(tx, pedidoId, { userId: loja.loja.integracao.criadoPorId, nome: "Integração iFood" });
    }
    return recebido ? "Cancelamento confirmado. Tratamento dos valores recebidos aguardando comprovação no fluxo de cancelamento." : null;
  }
  const existentes = titulos.filter(t => t.pedidoEfeitoChave?.startsWith("ifood:pagamento:"));
  if (existentes.length) {
    const c = obrigacoesFinanceirasIfood(remoto), metodos = c.metodos.filter(m => new Prisma.Decimal(m.valor).gt(0));
    if (c.pendencia || existentes.length !== metodos.length || metodos.some(m => !existentes.some(t => t.pedidoEfeitoChave === "ifood:pagamento:" + m.indice && t.pedidoValorOriginal?.eq(m.valor) && objeto(t.pedidoFormaSnapshot).metodo === m.metodo && t.status !== "CANCELADO"))) return "Pedido atualizado: confira os títulos existentes na carteira, preservando baixas e conciliações";
    return null;
  }
  if (!p.confirmadoEm) return "Aguardando confirmação comercial do iFood";
  if (remoto.pendencias.length) return "Conferir divergências do pedido antes da projeção financeira";
  const composicao = obrigacoesFinanceirasIfood(remoto);
  if (composicao.pendencia) return composicao.pendencia;
  const categoria = p.canal?.categoriaReceitaId ? await tx.categoriaFinanceira.findUnique({ where: { id: p.canal.categoriaReceitaId } }) : null;
  if (!categoria?.ativo || categoria.excluidoEm || categoria.grupo !== "RECEITA_BRUTA") return "Defina a categoria de receita do canal iFood";
  const loja = await tx.pedidoIfood.findUnique({ where: { pedidoId }, select: { loja: { select: { ambiente: true, financeiroConfig: true, integracao: { select: { criadoPorId: true } } } } } });
  if (loja?.loja.ambiente === "TESTE") return null;
  if (!loja?.loja.financeiroConfig) return "Configuração financeira pendente no cadastro da loja iFood; recepção preservada";
  let config;
  try { config = validarFinanceiroConfigIfood(loja.loja.financeiroConfig); } catch { return "Confira a configuração financeira no cadastro da loja iFood"; }
  const formas: Record<string, string> = {};
  for (const m of composicao.metodos.filter(m => new Prisma.Decimal(m.valor).gt(0))) {
    const formaId = config.formas[m.metodo];
    const forma = formaId ? await tx.formaPagamentoVenda.findUnique({ where: { id: formaId } }) : null;
    if (!forma?.ativo) return `Configure o pagamento ${m.metodo} no cadastro da loja iFood; recepção preservada`;
    formas[String(m.indice)] = forma.id;
  }
  const autor = await tx.usuario.findUnique({ where: { id: loja.loja.integracao.criadoPorId }, select: { id: true, nome: true } });
  if (!autor) return "Responsável pela integração indisponível no cadastro";
  await gerarTitulosIfood(tx, pedidoId, remoto, vencimentoPrevistoIfood(diaNoFuso(p.confirmadoEm, p.fusoHorario), config), autor, formas, true);
  return null;

}

export async function gerarTitulosIfood(tx: Prisma.TransactionClient, pedidoId: string, remoto: PedidoAdaptado, vencimento: Date, autor: { id: string; nome: string }, formas: Record<string, string>, vencimentoPrevisto = false) {
  await exigirEfeitoOperacional(tx, pedidoId);
  if (process.env.NODE_ENV === "production") {
    const vinculo = await tx.pedidoIfood.findUnique({ where: { pedidoId }, select: { loja: { select: { ambiente: true } } } });
    if (vinculo?.loja.ambiente === "TESTE") throw new ErroIfood("Pedido de teste não gera lançamentos na carteira operacional.");
  }
  const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, include: { canal: true } });
  if (!p.confirmadoEm || p.status !== "CONFIRMADO" || remoto.pendencias.length) throw new ErroIfood("Pedido indisponível para projeção financeira.");
  const composicao = obrigacoesFinanceirasIfood(remoto);
  if (composicao.pendencia) throw new ErroIfood(composicao.pendencia);
  const categoria = p.canal?.categoriaReceitaId ? await tx.categoriaFinanceira.findUnique({ where: { id: p.canal.categoriaReceitaId } }) : null;
  if (!categoria?.ativo || categoria.excluidoEm || categoria.grupo !== "RECEITA_BRUTA") throw new ErroIfood("Categoria de receita indisponível.");
  const titulosAnteriores = await tx.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id, pedidoEfeitoChave: { startsWith: "ifood:pagamento:" } } });
  if (titulosAnteriores.some(t => !composicao.metodos.some(m => t.pedidoEfeitoChave === "ifood:pagamento:" + m.indice))) throw new ErroIfood("Composição alterada: confira os títulos existentes na carteira.");
  const competencia = new Date(diaNoFuso(p.confirmadoEm, p.fusoHorario) + "T12:00:00Z");
  for (const m of composicao.metodos.filter(m => new Prisma.Decimal(m.valor).gt(0))) {
    const forma = await tx.formaPagamentoVenda.findUnique({ where: { id: formas[String(m.indice)] ?? "" } });
    if (!forma?.ativo) throw new ErroIfood("Selecione uma forma de pagamento ativa do HUB para cada pagamento recebido.");
    const efeito = `ifood:pagamento:${m.indice}`;
    const existente = await tx.lancamentoFinanceiro.findUnique({ where: { pedidoVendaId_pedidoEfeitoChave: { pedidoVendaId: p.id, pedidoEfeitoChave: efeito } } });
    if (existente && (!existente.pedidoValorOriginal?.eq(m.valor) || existente.status === "CANCELADO" || existente.formaPagamentoVendaId !== forma.id || existente.dataVencimento.getTime() !== vencimento.getTime())) throw new ErroIfood("Pedido alterado: ajuste os títulos existentes na carteira, preservando baixas e conciliações.");
    const titulo = await tx.lancamentoFinanceiro.upsert({ where: { pedidoVendaId_pedidoEfeitoChave: { pedidoVendaId: p.id, pedidoEfeitoChave: efeito } }, update: {}, create: {
      tipo: "RECEITA", descricao: `Pedido #${p.numero} · iFood · ${m.prePago ? "a receber do iFood" : "cobrança na entrega"}`,
      valor: m.valor, categoriaId: categoria.id, dataCompetencia: competencia, dataVencimento: vencimento, criadoPorId: autor.id,
      formaPagamentoVendaId: forma.id, pedidoVendaId: p.id, pedidoEfeitoChave: efeito, pedidoParcelaRaiz: efeito, pedidoValorOriginal: m.valor,
      pedidoFormaSnapshot: { ...m, vencimentoPrevisto, valoresIfood: remoto.valores, pagamentosInformados: remoto.metodos, id: forma.id, nome: forma.nome, tipo: m.prePago ? "IFOOD_ONLINE" : "IFOOD_ENTREGA" },
    } });
    if (m.prePago) await tx.pagamentoExternoPedido.upsert({ where: { chaveOperacao: `${p.id}:${efeito}` }, update: {}, create: {
      pedidoId: p.id, tituloId: titulo.id, tipo: "IFOOD", status: "CAPTURADO", valorBruto: m.valor,
      referenciaExterna: `${p.id}:${m.indice}`, confirmadoEm: p.confirmadoEm, evidencia: "Obrigação calculada a partir de pagamentos/subsídios informados no Order, excluindo taxas de receita iFood; repasse não confirmado",
      criadoPorId: autor.id, chaveOperacao: `${p.id}:${efeito}`, hashOperacao: p.hashCriacao,
    } });
  }
  await tx.historicoFinanceiroPedido.upsert({ where: { chaveOperacao: `ifood-titulos:${p.id}` }, update: {}, create: { pedidoId: p.id, chaveOperacao: `ifood-titulos:${p.id}`, hashOperacao: p.hashCriacao, tipo: "IFOOD_TITULOS", usuarioId: autor.id, usuarioNome: autor.nome, detalhes: { vencimento: vencimento.toISOString(), baixaAutomatica: false } } });
}
