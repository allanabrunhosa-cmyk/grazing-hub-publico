ALTER TABLE "PedidoVenda" ADD COLUMN "statusOperacional" TEXT NOT NULL DEFAULT 'PENDENTE';
UPDATE "PedidoVenda" SET "statusOperacional" = CASE WHEN "entregueEm" IS NOT NULL THEN 'ENTREGUE' WHEN status = 'CANCELADO' THEN 'INTERROMPIDO' ELSE 'PENDENTE' END;
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_statusOperacional_check" CHECK ("statusOperacional" IN ('PENDENTE', 'EM_PREPARO', 'PRONTO', 'EM_ENTREGA', 'ENTREGUE', 'INTERROMPIDO'));
CREATE INDEX "PedidoVenda_statusOperacional_previsaoData_idx" ON "PedidoVenda"("statusOperacional", "previsaoData");
