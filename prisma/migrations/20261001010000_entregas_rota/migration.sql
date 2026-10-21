-- Aditiva: nenhum pedido histórico ou valor comercial é recalculado.
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "entregas" JSONB,
  ADD COLUMN "versaoEntregas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PedidoVenda" ADD COLUMN "entregaSnapshot" JSONB,
  ADD COLUMN "custoEntregaEstimado" DECIMAL(14,2),
  ADD COLUMN "custoEntregaEfetivo" DECIMAL(14,2),
  ADD COLUMN "prestadorEntregaId" TEXT;
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_prestadorEntregaId_fkey"
  FOREIGN KEY ("prestadorEntregaId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_custosEntrega_nao_negativos"
  CHECK (("custoEntregaEstimado" IS NULL OR "custoEntregaEstimado" >= 0)
    AND ("custoEntregaEfetivo" IS NULL OR "custoEntregaEfetivo" >= 0));
CREATE TABLE "UsoMapaEntrega" (
  "id" TEXT PRIMARY KEY, "quantidade" INTEGER NOT NULL DEFAULT 0,
  "expiraEm" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "UsoMapaEntrega_expiraEm_idx" ON "UsoMapaEntrega"("expiraEm");
