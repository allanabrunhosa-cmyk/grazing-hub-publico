/**
 * Taxa de recebimento ou de repasse de um Pedido. Nasce pendente quando a receita é
 * baixada e é tratada em Movimentações como qualquer outra despesa: baixa, estorno e
 * conciliação manuais. Os demais títulos de Pedido continuam com efeitos no próprio pedido.
 */
export function ehTaxaDePedido(l: { tipo: string; pedidoVendaId?: string | null; pedidoEfeitoChave?: string | null }): boolean {
  return !!l.pedidoVendaId && l.tipo === "DESPESA" && !!l.pedidoEfeitoChave && /^taxa-(recebimento|repasse):/.test(l.pedidoEfeitoChave);
}
