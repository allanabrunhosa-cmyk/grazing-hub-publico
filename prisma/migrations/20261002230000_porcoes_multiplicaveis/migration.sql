ALTER TABLE "PorcaoInsumo"
  ADD COLUMN "quantidadeMedida" DECIMAL(18,9),
  ADD COLUMN "unidadeMedida" VARCHAR(100);

-- Separação textual da medida existente; não altera a quantidade do insumo,
-- os nomes/chaves, composições, custos ou estoque. Nomes livres continuam como 1 medida.
WITH nomes AS (
  SELECT id, nome, regexp_match(nome, '^([0-9]{1,9}([.,][0-9]{1,9})?) +(.+)$') AS partes
  FROM "PorcaoInsumo"
), medidas AS (
  SELECT id,
    CASE WHEN replace(partes[1], ',', '.')::numeric > 0
      THEN replace(partes[1], ',', '.')::numeric ELSE 1 END AS quantidade,
    CASE WHEN replace(partes[1], ',', '.')::numeric > 0
      THEN trim(partes[3]) ELSE nome END AS unidade
  FROM nomes
)
UPDATE "PorcaoInsumo" p
SET "quantidadeMedida" = m.quantidade, "unidadeMedida" = m.unidade
FROM medidas m
WHERE p.id = m.id AND length(m.unidade) BETWEEN 1 AND 100;
-- Nomes livres excepcionalmente longos mantêm campos nulos e o nome original intacto.

ALTER TABLE "PorcaoInsumo" ADD CONSTRAINT "PorcaoInsumo_medida_valida"
  CHECK (("quantidadeMedida" IS NULL AND "unidadeMedida" IS NULL)
    OR ("quantidadeMedida" IS NOT NULL AND "quantidadeMedida" > 0 AND "unidadeMedida" IS NOT NULL AND length(trim("unidadeMedida")) > 0));

ALTER TABLE "ComposicaoInsumo" ADD COLUMN "porcao" JSONB;
ALTER TABLE "ComponenteProdutoVenda" ADD COLUMN "porcao" JSONB;
