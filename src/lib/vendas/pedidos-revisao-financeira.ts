import { Prisma, type LancamentoFinanceiro } from "@/generated/prisma/client";
import { ErroPedidoVenda } from "./pedidos-dominio";

// Chamado sob as travas do pedido e dos títulos. Pagos e capturas são fatos
// imutáveis; somente saldo ainda não cobrado pode ser redistribuído.
type CondicaoSaldo = { valor: Prisma.Decimal; vencimento: Date; formaId: string; snapshot: Prisma.InputJsonValue };
export async function revisarObrigacoesPedido(tx: Prisma.TransactionClient, pedidoId: string, novoTotal: Prisma.Decimal, titulos: LancamentoFinanceiro[], chave: string, usuarioId: string, condicao?: { alterada: boolean; preparar: (saldo: Prisma.Decimal) => Promise<CondicaoSaldo[]> }) {
  const externos = await tx.pagamentoExternoPedido.findMany({ where: { pedidoId, status: { in: ["CAPTURADO", "EMITIDO"] } }, include: { titulo: { select: { pedidoParcelaRaiz: true } } } });
  const raizesProtegidas = new Set(externos.map(e => e.titulo.pedidoParcelaRaiz));
  const elegiveis = titulos.filter(t => t.status === "PENDENTE" && !raizesProtegidas.has(t.pedidoParcelaRaiz)).sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime() || a.id.localeCompare(b.id));
  const tratamentos = await tx.tratamentoFinanceiroPedido.findMany({ where: { pedidoId, status: { in: ["SOLICITADA", "PROCESSANDO", "CONCLUIDA"] } }, select: { valor: true, reduzVenda: true } });
  const liberacoes = await tx.creditoClienteMovimento.findMany({ where: { pedidoAplicacaoId: pedidoId, tipo: "LIBERACAO" }, select: { valor: true, reduzVenda: true } });
  const abatimentos = [...tratamentos, ...liberacoes];
  const soma = (valores: typeof abatimentos) => valores.reduce((s, t) => s.plus(t.valor), new Prisma.Decimal(0));
  const preservado = titulos.filter(t => t.status === "BAIXADO" || t.status === "PENDENTE" && raizesProtegidas.has(t.pedidoParcelaRaiz)).reduce((s, t) => s.plus(t.valor), new Prisma.Decimal(0))
    .minus(soma(abatimentos));
  const totalDevido = Prisma.Decimal.max(0, novoTotal.minus(soma(abatimentos.filter(t => t.reduzVenda))));
  const saldo = Prisma.Decimal.max(0, totalDevido.minus(preservado));
  const alteracoes: { id: string; anterior: string; novo: string; status: string }[] = [];
  if (condicao && (condicao.alterada || !elegiveis.length && saldo.gt(0))) {
    const base = titulos[0];
    if (!base) throw new ErroPedidoVenda("O pedido não possui a origem financeira da confirmação.");
    const parcelas = saldo.gt(0) ? await condicao.preparar(saldo) : [];
    if (!soma(parcelas.map(p => ({ valor: p.valor, reduzVenda: false }))).eq(saldo)) throw new ErroPedidoVenda("A condição revisada não fecha com o saldo.");
    for (const t of elegiveis) {
      await tx.lancamentoFinanceiro.update({ where: { id: t.id }, data: { status: "CANCELADO" } });
      alteracoes.push({ id: t.id, anterior: t.valor.toFixed(2), novo: "0.00", status: "CANCELADO" });
    }
    for (const [n, p] of parcelas.entries()) {
      const t = await tx.lancamentoFinanceiro.create({ data: { tipo: "RECEITA", descricao: `${base.descricao} · revisão ${n + 1}/${parcelas.length}`, valor: p.valor,
        categoriaId: base.categoriaId, dataCompetencia: base.dataCompetencia, dataVencimento: p.vencimento, contraparteNome: base.contraparteNome,
        criadoPorId: usuarioId, pedidoVendaId: pedidoId, pedidoEfeitoChave: `revisao:${chave}:${n}`, pedidoParcelaRaiz: `revisao-${chave}-${n}`,
        pedidoValorOriginal: p.valor, formaPagamentoVendaId: p.formaId, pedidoFormaSnapshot: p.snapshot } });
      alteracoes.push({ id: t.id, anterior: "0.00", novo: p.valor.toFixed(2), status: "PENDENTE" });
    }
    return { preservado: preservado.toFixed(2), saldo: saldo.toFixed(2), excedente: Prisma.Decimal.max(0, preservado.minus(totalDevido)).toFixed(2), alteracoes };
  }
  const anterior = elegiveis.reduce((s, t) => s.plus(t.valor), new Prisma.Decimal(0));
  let restante = saldo;
  for (let i = 0; i < elegiveis.length; i++) {
    const t = elegiveis[i];
    const valor = i === elegiveis.length - 1 ? restante : saldo.mul(t.valor).div(anterior).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    restante = restante.minus(valor);
    const status = valor.isZero() ? "CANCELADO" : "PENDENTE";
    await tx.lancamentoFinanceiro.update({ where: { id: t.id }, data: valor.isZero() ? { status } : { valor } });
    alteracoes.push({ id: t.id, anterior: t.valor.toFixed(2), novo: valor.toFixed(2), status });
  }
  if (!elegiveis.length && saldo.gt(0)) {
    const base = titulos.find(t => t.formaPagamentoVendaId && t.pedidoFormaSnapshot);
    if (!base) throw new ErroPedidoVenda("Informe uma condição de pagamento para o saldo adicional antes de revisar.");
    const novo = await tx.lancamentoFinanceiro.create({ data: {
      tipo: "RECEITA", descricao: `${base.descricao} · saldo da revisão`, valor: saldo,
      categoriaId: base.categoriaId, dataCompetencia: base.dataCompetencia, dataVencimento: base.dataVencimento,
      contraparteNome: base.contraparteNome, criadoPorId: usuarioId, pedidoVendaId: pedidoId,
      pedidoEfeitoChave: `revisao:${chave}`, pedidoParcelaRaiz: `revisao-${chave}`, pedidoValorOriginal: saldo,
      formaPagamentoVendaId: base.formaPagamentoVendaId, pedidoFormaSnapshot: base.pedidoFormaSnapshot as Prisma.InputJsonValue,
    } });
    alteracoes.push({ id: novo.id, anterior: "0.00", novo: saldo.toFixed(2), status: "PENDENTE" });
  }
  return { preservado: preservado.toFixed(2), saldo: saldo.toFixed(2), excedente: Prisma.Decimal.max(0, preservado.minus(novoTotal)).toFixed(2), alteracoes };
}
