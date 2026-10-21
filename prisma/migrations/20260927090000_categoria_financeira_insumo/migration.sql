ALTER TABLE "Insumo" ADD COLUMN "categoriaFinanceiraId" TEXT;
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_categoriaFinanceiraId_fkey"
  FOREIGN KEY ("categoriaFinanceiraId") REFERENCES "CategoriaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Insumo_categoriaFinanceiraId_idx" ON "Insumo"("categoriaFinanceiraId");
