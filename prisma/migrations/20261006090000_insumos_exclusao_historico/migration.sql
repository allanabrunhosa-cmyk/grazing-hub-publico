ALTER TABLE "Insumo" ADD COLUMN "excluidoEm" TIMESTAMP(3),
  ADD COLUMN "excluidoPorId" TEXT,
  ADD COLUMN "exclusaoSnapshot" JSONB;
CREATE INDEX "Insumo_excluidoEm_idx" ON "Insumo"("excluidoEm");
