-- Preserva frações positivas sem coerção para três casas. Os valores existentes
-- permanecem iguais; as quantidades de perdas, estornos, saldos e contagens
-- precisam compartilhar a mesma precisão.
ALTER TABLE "Perda" ALTER COLUMN "quantidade" TYPE NUMERIC;
ALTER TABLE "PerdaExclusao" ALTER COLUMN "quantidade" TYPE NUMERIC;
ALTER TABLE "SaldoEstoque" ALTER COLUMN "quantidadeAtual" TYPE NUMERIC;
ALTER TABLE "MovimentacaoEstoque" ALTER COLUMN "quantidade" TYPE NUMERIC;
ALTER TABLE "InventarioItem"
  ALTER COLUMN "quantidadeSistema" TYPE NUMERIC,
  ALTER COLUMN "quantidadeContada" TYPE NUMERIC;
