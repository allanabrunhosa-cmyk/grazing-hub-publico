-- Pedidos existentes, inclusive rascunhos EXTERNO, permanecem no contrato anterior.
ALTER TABLE "PedidoVenda" ADD COLUMN "versaoFinanceiro" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_versaoFinanceiro_check"
  CHECK ("versaoFinanceiro" IN (0, 1));
