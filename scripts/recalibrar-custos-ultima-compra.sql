-- Execução única de 23/09/2026 após exportar o custo anterior dos 253 insumos.
-- A última ENTRADA_COMPRA com custo positivo já está na unidade de controle
-- e inclui o rateio dos custos adicionais da compra. Pedidos, cotações,
-- ajustes de estoque e preparações não são fontes desta recalibração.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE plano_custos ON COMMIT DROP AS
WITH ultima_compra AS (
  SELECT DISTINCT ON ("insumoId") "insumoId", "custoUnitario"
  FROM "MovimentacaoEstoque"
  WHERE tipo = 'ENTRADA_COMPRA' AND "custoUnitario" > 0
  ORDER BY "insumoId", "createdAt" DESC, id DESC
)
SELECT insumo.id, insumo."custoMedio" AS anterior, ultima_compra."custoUnitario" AS novo
FROM "Insumo" AS insumo JOIN ultima_compra ON insumo.id = ultima_compra."insumoId"
WHERE insumo.tipo = 'INSUMO'
  AND insumo."custoMedio" IS DISTINCT FROM ultima_compra."custoUnitario";

DO $$ BEGIN
  IF (SELECT count(*) FROM plano_custos) <> 58 THEN
    RAISE EXCEPTION 'O número de custos divergentes mudou; refaça a auditoria e o backup.';
  END IF;
END $$;

CREATE TEMP TABLE custos_atualizados ON COMMIT DROP AS
WITH alterados AS (
  UPDATE "Insumo" AS insumo
  SET "custoMedio" = plano.novo, "updatedAt" = now()
  FROM plano_custos AS plano
  WHERE insumo.id = plano.id AND insumo."custoMedio" = plano.anterior
  RETURNING insumo.id
)
SELECT id FROM alterados;

DO $$ BEGIN
  IF (SELECT count(*) FROM custos_atualizados) <> 58 THEN
    RAISE EXCEPTION 'A atualização não corresponde ao plano completo; transação cancelada.';
  END IF;
END $$;

SELECT count(*) AS custos_atualizados FROM custos_atualizados;

COMMIT;
