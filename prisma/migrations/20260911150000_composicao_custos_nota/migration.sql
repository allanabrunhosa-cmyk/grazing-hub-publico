-- Preserva a composição confirmada; notas antigas e lançamentos existentes não são recalculados.
ALTER TABLE "NotaFiscalItem" ADD COLUMN "composicaoCusto" JSONB;
ALTER TABLE "NotaFiscalItem" ADD CONSTRAINT "NotaFiscalItem_composicaoCusto_objeto"
  CHECK ("composicaoCusto" IS NULL OR jsonb_typeof("composicaoCusto") = 'object');
