ALTER TYPE "StatusNfse" ADD VALUE 'ACEITA';
ALTER TYPE "StatusNfse" ADD VALUE 'RECUSADA';

DROP INDEX IF EXISTS "NotaFiscalServicoLancamento_notaFiscalServicoId_key";
CREATE INDEX IF NOT EXISTS "NotaFiscalServicoLancamento_notaFiscalServicoId_idx"
  ON "NotaFiscalServicoLancamento"("notaFiscalServicoId");
