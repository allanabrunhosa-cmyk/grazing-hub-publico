CREATE TABLE "CategoriaPerda" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "codigoLegado" "MotivoPerda",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CategoriaPerda_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CategoriaPerda_nome_check" CHECK (char_length(btrim("nome")) BETWEEN 3 AND 80)
);
CREATE UNIQUE INDEX "CategoriaPerda_codigoLegado_key" ON "CategoriaPerda"("codigoLegado");
CREATE UNIQUE INDEX "CategoriaPerda_nome_normalizado_key" ON "CategoriaPerda"(lower(btrim("nome")));

INSERT INTO "CategoriaPerda" ("id", "nome", "codigoLegado") VALUES
  ('perda-validade-vencida', 'Validade vencida', 'VALIDADE_VENCIDA'),
  ('perda-quebra', 'Quebra', 'QUEBRA'),
  ('perda-erro-producao', 'Erro de produção', 'ERRO_PRODUCAO'),
  ('perda-furto', 'Furto', 'FURTO'),
  ('perda-outro', 'Outro', 'OUTRO');

ALTER TABLE "Perda" ADD COLUMN "categoriaPerdaId" TEXT;
UPDATE "Perda" SET "categoriaPerdaId" = CASE "motivo"
  WHEN 'VALIDADE_VENCIDA' THEN 'perda-validade-vencida'
  WHEN 'QUEBRA' THEN 'perda-quebra'
  WHEN 'ERRO_PRODUCAO' THEN 'perda-erro-producao'
  WHEN 'FURTO' THEN 'perda-furto'
  WHEN 'OUTRO' THEN 'perda-outro'
END;
CREATE INDEX "Perda_categoriaPerdaId_idx" ON "Perda"("categoriaPerdaId");
ALTER TABLE "Perda" ADD CONSTRAINT "Perda_categoriaPerdaId_fkey"
  FOREIGN KEY ("categoriaPerdaId") REFERENCES "CategoriaPerda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
