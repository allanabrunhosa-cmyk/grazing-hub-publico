-- O registro único reserva códigos históricos e identifica cada cópia nova.
-- Não modifica o trabalho, o ZPL nem o snapshot de etiquetas já emitidas.
CREATE TABLE "CodigoEtiqueta" (
  "codigo" VARCHAR(6) NOT NULL,
  "trabalhoId" TEXT,
  "copia" INTEGER,
  CONSTRAINT "CodigoEtiqueta_pkey" PRIMARY KEY ("codigo"),
  CONSTRAINT "CodigoEtiqueta_codigo_check" CHECK ("codigo" ~ '^[A-Z0-9]{6}$'),
  CONSTRAINT "CodigoEtiqueta_vinculo_check" CHECK (
    ("trabalhoId" IS NULL AND "copia" IS NULL)
    OR ("trabalhoId" IS NOT NULL AND "copia" IS NOT NULL AND "copia" > 0)
  ),
  CONSTRAINT "CodigoEtiqueta_trabalhoId_fkey" FOREIGN KEY ("trabalhoId")
    REFERENCES "TrabalhoEtiqueta"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CodigoEtiqueta_trabalhoId_copia_key"
  ON "CodigoEtiqueta"("trabalhoId", "copia");

INSERT INTO "CodigoEtiqueta" ("codigo")
SELECT DISTINCT UPPER("codigoRastreio")
FROM "TrabalhoEtiqueta"
WHERE UPPER("codigoRastreio") ~ '^[A-Z0-9]{6}$'
ON CONFLICT ("codigo") DO NOTHING;
