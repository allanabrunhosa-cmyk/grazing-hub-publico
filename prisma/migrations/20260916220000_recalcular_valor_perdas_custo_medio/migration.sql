-- O valor histórico de cada perda passa a representar a quantidade
-- multiplicada pelo custo médio cadastrado do respectivo insumo.
UPDATE "Perda" AS perda
SET "valorEstimado" = ROUND(perda."quantidade" * insumo."custoMedio", 2)
FROM "Insumo" AS insumo
WHERE insumo."id" = perda."insumoId";
