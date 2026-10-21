CREATE TABLE "VinculoCustoEntrega" (
 "id" TEXT PRIMARY KEY,
 "pedidoId" TEXT NOT NULL REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "lancamentoId" TEXT NOT NULL REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "valor" DECIMAL(14,2) NOT NULL CHECK ("valor" > 0), "snapshot" JSONB NOT NULL, "criadoPorId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "desvinculadoEm" TIMESTAMP(3)
);
CREATE INDEX "VinculoCustoEntrega_pedidoId_desvinculadoEm_idx" ON "VinculoCustoEntrega"("pedidoId","desvinculadoEm");
CREATE INDEX "VinculoCustoEntrega_lancamentoId_desvinculadoEm_idx" ON "VinculoCustoEntrega"("lancamentoId","desvinculadoEm");
