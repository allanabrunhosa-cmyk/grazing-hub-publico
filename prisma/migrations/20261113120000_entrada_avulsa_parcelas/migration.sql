-- A mesma compra passa a admitir vários títulos, com a origem preservada.
CREATE INDEX "LancamentoFinanceiro_origemEntradaAvulsaCompraId_idx"
  ON "LancamentoFinanceiro"("origemEntradaAvulsaCompraId");

DROP INDEX "LancamentoFinanceiro_origemEntradaAvulsaCompraId_key";
