
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { MovimentacoesTable } from "@/app/(protegido)/inventario/movimentacoes/movimentacoes-table";
import type { MovimentacaoRow } from "@/app/(protegido)/inventario/types";
import { calcularSaldosMovimentacoes } from "@/lib/estoque/extrato";

export default async function MovimentacoesPage() {
  await exigirPermissao("inventario");
  // As duas leituras veem a mesma posição mesmo se houver lançamentos concorrentes.
  const [movimentacoes, saldos] = await prisma.$transaction([prisma.movimentacaoEstoque.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, createdAt: true, insumoId: true, localId: true, tipo: true, quantidade: true, observacao: true,
      insumo: { select: { nome: true, especificacao: true, unidade: true } },
      local: { select: { nome: true } },
    },
  }), prisma.saldoEstoque.findMany({ select: { insumoId: true, localId: true, quantidadeAtual: true } })], { isolationLevel: "RepeatableRead" });

  const extrato = calcularSaldosMovimentacoes(movimentacoes.map(m => ({ ...m, createdAt: m.createdAt.toISOString(), quantidade: Number(m.quantidade) })),
    saldos.map(s => ({ ...s, quantidadeAtual: Number(s.quantidadeAtual) })));

  const linhas: MovimentacaoRow[] = extrato.map((m) => ({
    id: m.id,
    createdAt: m.createdAt,
    insumoNome: m.insumo.nome,
    insumoEspecificacao: m.insumo.especificacao,
    unidade: m.insumo.unidade,
    localNome: m.local.nome,
    tipo: m.tipo,
    quantidade: Number(m.quantidade),
    saldo: m.saldo,
    observacao: m.observacao,
  }));

  return <MovimentacoesTable linhas={linhas} />;
}
