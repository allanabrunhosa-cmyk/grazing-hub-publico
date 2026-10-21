-- Distingue abatimento pós-venda de liquidação de excesso já reduzido por revisão.
-- O histórico permanece sem abatimento presumido ou backfill.
ALTER TABLE "TratamentoFinanceiroPedido" ADD COLUMN "reduzVenda" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreditoClienteMovimento" ADD COLUMN "reduzVenda" BOOLEAN NOT NULL DEFAULT false;
