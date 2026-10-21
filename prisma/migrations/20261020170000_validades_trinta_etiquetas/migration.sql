-- Novas lojas iniciam com 30 cópias. Limites maiores já escolhidos são preservados.
-- Não altera trabalhos, snapshots, tentativas, fila ou configurações da impressora.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE "ConfiguracaoLoja"
  ALTER COLUMN "maximoCopiasEtiqueta" SET DEFAULT 30;

UPDATE "ConfiguracaoLoja"
SET "maximoCopiasEtiqueta" = 30
WHERE "maximoCopiasEtiqueta" < 30;

COMMIT;
