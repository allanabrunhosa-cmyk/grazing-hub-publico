import { Prisma } from "@/generated/prisma/client";

type Valor = Prisma.Decimal | string | number;
export type OrigemCompetenciaPedido = {
  id: string; versaoFinanceiro: number; status: string; total: Valor;
  entregueEm: Date | null;
  tratamentosFinanceiros: { status: string; valor: Valor; retido: Valor; reduzVenda: boolean }[];
  movimentosCreditoAplicado: { tipo: string; valor: Valor; reduzVenda: boolean }[];
};
type Titulo = {
  id: string; tipo: string; status: string; valor: Valor;
  pedidoEfeitoChave: string | null; pedidoVenda: OrigemCompetenciaPedido | null;
};

// Projeção dos próprios títulos, sem outro livro ou movimento. A versão zero
// conserva a política histórica. Caixa usa sempre valor/data reais do título.
// O total comercial revisado e os tratamentos auditados limitam a receita da
// confirmação, mantendo sua categoria e competência originais.
export function valoresCompetenciaPedidos(titulos: Titulo[]): Map<string, number> {
  const valores = new Map<string, number>();
  const grupos = new Map<string, Titulo[]>();
  for (const t of titulos) {
    if (t.pedidoEfeitoChave?.startsWith("tardio:") && t.pedidoVenda?.versaoFinanceiro === 0 && t.pedidoVenda.status === "CANCELADO") {
      // Entrada posterior ao cancelamento é dinheiro a tratar, não nova venda.
      // Prefixo exclusivo da ação explícita; não reclassifica títulos históricos.
      valores.set(t.id, 0); continue;
    }
    if (t.pedidoVenda?.versaoFinanceiro !== 1) continue;
    if (t.tipo === "DESPESA" && t.pedidoEfeitoChave?.startsWith("devolucao:")) {
      // A redução já está na venda. A saída conserva seu valor para caixa.
      valores.set(t.id, 0);
    }
    if (t.tipo !== "RECEITA" || t.status === "CANCELADO") continue;
    const grupo = grupos.get(t.pedidoVenda.id) ?? [];
    grupo.push(t); grupos.set(t.pedidoVenda.id, grupo);
  }
  for (const grupo of grupos.values()) {
    grupo.sort((a, b) => a.id.localeCompare(b.id));
    const pedido = grupo[0].pedidoVenda!;
    const ativos = pedido.tratamentosFinanceiros.filter(t => ["SOLICITADA", "PROCESSANDO", "CONCLUIDA"].includes(t.status));
    const retido = ativos.reduce((s, t) => s.plus(t.retido), new Prisma.Decimal(0));
    const reducao = ativos.filter(t => t.reduzVenda).reduce((s, t) => s.plus(t.valor), new Prisma.Decimal(0))
      .plus(pedido.movimentosCreditoAplicado.filter(m => m.tipo === "LIBERACAO" && m.reduzVenda).reduce((s, m) => s.plus(m.valor), new Prisma.Decimal(0)));
    const alvo = pedido.status === "CANCELADO" ? retido : Prisma.Decimal.max(0, new Prisma.Decimal(pedido.total).minus(reducao));
    const soma = grupo.reduce((s, t) => s.plus(t.valor), new Prisma.Decimal(0));
    if (alvo.gt(soma)) throw new Error("Receita do pedido excede os títulos: confira suas obrigações financeiras.");
    let restante = alvo;
    grupo.forEach((t, i) => {
      const valor = i === grupo.length - 1 ? restante : alvo.mul(t.valor).div(soma).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
      valores.set(t.id, Number(valor)); restante = restante.minus(valor);
    });
  }
  return valores;
}
