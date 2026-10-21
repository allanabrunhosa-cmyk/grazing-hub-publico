ALTER TABLE "Insumo" ADD COLUMN "marcasHomologadas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Preserva o texto antigo como uma marca, sem presumir separadores em nomes existentes.
UPDATE "Insumo"
SET "marcasHomologadas" = ARRAY[BTRIM("marca")]
WHERE "marca" IS NOT NULL AND BTRIM("marca") <> '';
