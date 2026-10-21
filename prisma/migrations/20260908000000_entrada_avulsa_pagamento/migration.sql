-- Campos de compra/pagamento na entrada avulsa — preparação pro futuro módulo de
-- Contas a Pagar. Só usados por entradas do tipo "compra simples".
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "valorTotal" DECIMAL(14,2);
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "dataVencimento" TIMESTAMP(3);
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "pago" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "dataPagamento" TIMESTAMP(3);
