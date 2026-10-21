ALTER TABLE "TrabalhoEtiqueta"
  ADD COLUMN "lojaEndereco" TEXT,
  ADD COLUMN "marcaFornecedor" TEXT,
  ADD COLUMN "sif" TEXT,
  ADD COLUMN "validadeOriginal" TEXT,
  ADD COLUMN "codigoRastreio" TEXT;

UPDATE "TrabalhoEtiqueta"
SET "codigoRastreio" = UPPER(SUBSTRING(REPLACE("chaveIdempotencia", '-', '') FROM 1 FOR 6))
WHERE "codigoRastreio" IS NULL;

ALTER TABLE "TrabalhoEtiqueta"
  ALTER COLUMN "codigoRastreio" SET NOT NULL;
