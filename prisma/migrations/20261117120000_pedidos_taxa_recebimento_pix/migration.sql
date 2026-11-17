-- Taxa do Pix lançada no recebimento direto de Pedidos.
-- Amplia somente os efeitos de despesa aceitos; as demais regras são as vigentes
-- desde 20260924200000_pedidos_credito_cliente. Nenhuma linha é alterada.
ALTER TABLE "LancamentoFinanceiro" DROP CONSTRAINT "LancamentoFinanceiro_pedido_campos_check";
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_pedido_campos_check" CHECK (
  ("pedidoVendaId" IS NULL AND "pedidoEfeitoChave" IS NULL AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL AND NOT "pedidoQuitadoCredito")
  OR ("pedidoVendaId" IS NOT NULL AND "pedidoEfeitoChave" IS NOT NULL AND (
    ("tipo" = 'RECEITA' AND "pedidoParcelaRaiz" IS NOT NULL AND "pedidoValorOriginal" > 0 AND "pedidoFormaSnapshot" IS NOT NULL AND ((NOT "pedidoQuitadoCredito" AND "formaPagamentoVendaId" IS NOT NULL) OR ("pedidoQuitadoCredito" AND "formaPagamentoVendaId" IS NULL AND "pedidoEfeitoChave" LIKE 'credito:%')))
    OR ("tipo" = 'DESPESA' AND NOT "pedidoQuitadoCredito" AND ("pedidoEfeitoChave" LIKE 'taxa-repasse:%' OR "pedidoEfeitoChave" LIKE 'devolucao:%' OR "pedidoEfeitoChave" LIKE 'taxa-recebimento:%') AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL)
  ))
);
