-- Datas civis explícitas; não reescreve notas, parcelas ou movimentos anteriores.
ALTER TABLE "NotaFiscalServico" ADD COLUMN "dataVencimento" DATE;
ALTER TABLE "NotaFiscalItem" ADD COLUMN "dataRecebimento" DATE;

CREATE TYPE "TratamentoLocalNotaFiscal" AS ENUM ('DEVOLUCAO_REGISTRADA', 'IGNORADA');

ALTER TABLE "NotaFiscalRecebida"
  ADD COLUMN "tratamentoLocal" "TratamentoLocalNotaFiscal",
  ADD COLUMN "dataDevolucao" DATE,
  ADD COLUMN "motivoTratamentoLocal" VARCHAR(500),
  ADD COLUMN "tratamentoLocalEm" TIMESTAMP(3),
  ADD COLUMN "tratamentoLocalVersao" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "NotaFiscalRecebida_tratamentoLocalVersao_check"
    CHECK ("tratamentoLocalVersao" >= 0),
  ADD CONSTRAINT "NotaFiscalRecebida_tratamentoLocal_check" CHECK (
    ("tratamentoLocal" IS NULL AND "dataDevolucao" IS NULL
      AND "motivoTratamentoLocal" IS NULL AND "tratamentoLocalEm" IS NULL)
    OR ("tratamentoLocal" IS NOT NULL AND "tratamentoLocalEm" IS NOT NULL
      AND "motivoTratamentoLocal" IS NOT NULL
      AND char_length(btrim("motivoTratamentoLocal")) BETWEEN 15 AND 500
      AND (("tratamentoLocal" = 'DEVOLUCAO_REGISTRADA' AND "dataDevolucao" IS NOT NULL)
        OR ("tratamentoLocal" = 'IGNORADA' AND "dataDevolucao" IS NULL)))
  );
