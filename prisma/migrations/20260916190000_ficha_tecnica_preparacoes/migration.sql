-- Ficha técnica de preparações e prazos adicionais usados pelo módulo de etiquetas.
ALTER TYPE "ConservacaoEtiqueta" ADD VALUE IF NOT EXISTS 'SECO';
ALTER TYPE "ConservacaoEtiqueta" ADD VALUE IF NOT EXISTS 'APOS_ABERTO';

ALTER TABLE "Insumo"
  ADD COLUMN "modoPreparo" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "validadeSecoDias" INTEGER,
  ADD COLUMN "validadeAposAbertoDias" INTEGER;

ALTER TABLE "ComposicaoInsumo"
  ADD COLUMN "observacaoPorcao" TEXT;

ALTER TABLE "Insumo"
  ADD CONSTRAINT "Insumo_validadeSecoDias_check"
    CHECK ("validadeSecoDias" IS NULL OR "validadeSecoDias" > 0),
  ADD CONSTRAINT "Insumo_validadeAposAbertoDias_check"
    CHECK ("validadeAposAbertoDias" IS NULL OR "validadeAposAbertoDias" > 0);
