import "server-only";
import { prisma } from "@/lib/prisma";
import { calcularSaldosMovimentacoes, TIPOS_ENTRADA, movimentacaoNoPeriodo } from "./extrato";
import { DecimalEstoque } from "./quantidade";
import { dataCalendarioValida } from "@/lib/financeiro/cartoes";
import { tipoMovimentacaoEstoqueLabels } from "@/lib/labels";
import { ErroCorrecaoEntrada } from "@/lib/inventario/entrada-avulsa-historico";
export type FiltroExtratoIndividual = { insumoId: string; de: string; ate: string; tipo: string; ordem: "asc" | "desc"; pagina: number };
export type ExtratoIndividualDTO = { pagina: number; paginas: number; total: number; linhas: { id: string; data: string; tipo: string; quantidade: string; entrada: boolean; saldoAnterior: string | null; saldoPosterior: string | null; local: string; responsavel: string; origem: string; identificador: string; href: string | null; observacao: string | null }[] };
export async function consultarExtratoIndividual(f: FiltroExtratoIndividual): Promise<ExtratoIndividualDTO> {
  if (!f || !/^[a-zA-Z0-9_-]{1,160}$/.test(f.insumoId) || !Number.isInteger(f.pagina) || f.pagina < 1 || f.pagina > 100000
    || !["asc", "desc"].includes(f.ordem) || (f.tipo && !(f.tipo in tipoMovimentacaoEstoqueLabels))
    || [f.de, f.ate].some(d => d && !dataCalendarioValida(d)) || (f.de && f.ate && f.de > f.ate)) throw new ErroCorrecaoEntrada("Confira os filtros de movimentações.");
  return prisma.$transaction(async tx => {
    const [movimentos, saldos] = await Promise.all([
      tx.movimentacaoEstoque.findMany({ where: { insumoId: f.insumoId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: {
        local: { select: { nome: true } }, criadoPor: { select: { nome: true } },
        entradaAvulsaRegistro: { select: { id: true, numero: true } }, entradaAvulsaCompra: { select: { id: true } },
        notaFiscalItem: { select: { notaFiscalId: true } }, origemRecebimentoItem: { select: { recebimento: { select: { pedidoId: true } } } },
        origemPerda: { select: { id: true } }, exclusaoPerda: { select: { perdaId: true } },
        ajusteContagem: { select: { contagemId: true } }, estornoContagem: { select: { contagemId: true } },
      } }),
      tx.saldoEstoque.findMany({ where: { insumoId: f.insumoId } }),
    ]);
    const locaisSemPrecisao = new Set([...movimentos.filter(m => !new DecimalEstoque(Number(m.quantidade)).equals(m.quantidade)).map(m => m.localId), ...saldos.filter(s => !new DecimalEstoque(Number(s.quantidadeAtual)).equals(s.quantidadeAtual)).map(s => s.localId)]);
    const extrato = calcularSaldosMovimentacoes(movimentos.map(m => ({ ...m, quantidadeRegistrada: m.quantidade.toString(), createdAt: m.createdAt.toISOString(), quantidade: Number(m.quantidade) })), saldos.map(s => ({ ...s, quantidadeAtual: Number(s.quantidadeAtual) })));
    const selecionadas = extrato.filter(m => movimentacaoNoPeriodo(m.createdAt, f.de, f.ate) && (!f.tipo || m.tipo === f.tipo));
    if (f.ordem === "asc") selecionadas.reverse();
    const paginas = Math.max(1, Math.ceil(selecionadas.length / 25)), pagina = Math.min(f.pagina, paginas);
    const trecho = selecionadas.slice((pagina - 1) * 25, pagina * 25);
    const atividades = await tx.atividadeUsuario.findMany({ where: { fonteTabela: "MovimentacaoEstoque", fonteId: { in: trecho.map(m => m.id) } }, select: { fonteId: true, autorNome: true, atorReferencia: true }, orderBy: { ocorridoEm: "asc" } });
    // Referências do histórico físico, inclusive Gestor automático. Não extrair pedido de texto livre.
    const fatos = trecho.length ? await tx.historicoPedidoVenda.findMany({ where: { OR: trecho.flatMap(m => [
      { depois: { path: ["detalhe", "movimentoId"], equals: m.id } }, { depois: { path: ["detalhe", "movimentacaoId"], equals: m.id } },
    ]) }, select: { pedidoId: true, depois: true } }) : [];
    return { total: selecionadas.length, pagina, paginas, linhas: trecho.map(m => {
      let origem = "Movimentação de estoque", identificador = m.id, href: string | null = null;
      const fato = fatos.find(h => { const d = h.depois as { detalhe?: { movimentoId?: string; movimentacaoId?: string } }; return d.detalhe?.movimentoId === m.id || d.detalhe?.movimentacaoId === m.id; });
      if (m.entradaAvulsaRegistro) { origem = "Entrada avulsa"; identificador = `EA-${String(m.entradaAvulsaRegistro.numero).padStart(6, "0")}`; href = `/inventario/entradas/${m.entradaAvulsaRegistro.id}`; }
      else if (m.entradaAvulsaCompra) { origem = "Entrada avulsa"; identificador = m.entradaAvulsaCompra.id; href = `/inventario/entradas/${encodeURIComponent(`compra:${identificador}`)}`; }
      else if (fato) { origem = "Pedido"; identificador = fato.pedidoId; href = `/vendas/pedidos/${identificador}`; }
      else if (m.producaoPreparacaoId) { origem = "Produção de preparação"; identificador = m.producaoPreparacaoId; href = `/inventario/movimentacoes/${m.id}`; }
      else if (m.notaFiscalItem) { origem = "Nota fiscal"; identificador = m.notaFiscalItem.notaFiscalId; href = `/inventario/movimentacoes/${m.id}`; }
      else if (m.origemRecebimentoItem) { origem = "Compra"; identificador = m.origemRecebimentoItem.recebimento.pedidoId; href = `/compras?entidade=${identificador}`; }
      else if (m.ajusteContagem || m.estornoContagem) { origem = m.estornoContagem ? "Estorno de contagem" : "Contagem"; identificador = (m.ajusteContagem ?? m.estornoContagem)!.contagemId; href = `/inventario/contagem/${identificador}`; }
      else if (m.origemPerda || m.exclusaoPerda) { origem = m.exclusaoPerda ? "Estorno de perda" : "Perda"; identificador = m.origemPerda?.id ?? m.exclusaoPerda!.perdaId; href = `/inventario/movimentacoes/${m.id}`; }
      else if (m.estornoDeId) { origem = "Estorno"; identificador = m.estornoDeId; href = `/inventario/movimentacoes/${m.id}`; }
      const entrada = TIPOS_ENTRADA.includes(m.tipo);
      const saldo = locaisSemPrecisao.has(m.localId) ? null : m.saldo;
      const atividade = atividades.find(a => a.fonteId === m.id);
      return { id: m.id, data: m.createdAt, tipo: m.tipo, quantidade: m.quantidadeRegistrada, entrada,
        saldoPosterior: saldo === null ? null : String(saldo), saldoAnterior: saldo === null ? null : new DecimalEstoque(saldo).minus(new DecimalEstoque(m.quantidadeRegistrada).times(entrada ? 1 : -1)).toString(),
        local: m.local.nome, responsavel: m.criadoPor?.nome ?? atividade?.autorNome ?? atividade?.atorReferencia ?? "Não registrado", origem, identificador, href, observacao: m.observacao };
    }) };
  }, { isolationLevel: "RepeatableRead" });
}
