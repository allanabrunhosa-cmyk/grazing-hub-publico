CREATE TYPE "DestinoFinanceiroNfse" AS ENUM ('FINANCEIRO', 'SOMENTE_FISCAL');

ALTER TABLE "NotaFiscalServico"
  ADD COLUMN "destinoFinanceiro" "DestinoFinanceiroNfse",
  ADD CONSTRAINT "NotaFiscalServico_destinoFinanceiro_check"
    CHECK ("status" <> 'LANCADA' OR "destinoFinanceiro" IS DISTINCT FROM 'SOMENTE_FISCAL');
