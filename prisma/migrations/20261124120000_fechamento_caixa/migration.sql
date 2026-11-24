-- Fechamento mensal do fluxo de caixa.
-- SQL manual aditivo: cria somente uma tabela nova. Não altera lançamentos, baixas,
-- saldos nem documentos existentes.
BEGIN;
CREATE TABLE "FechamentoCaixa" (
  "id" TEXT NOT NULL,
  "mes" TEXT NOT NULL,
  "fechadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechadoPorId" TEXT NOT NULL,
  "fechadoPorNome" TEXT NOT NULL,
  "reabertoEm" TIMESTAMP(3),
  "reabertoPorId" TEXT,
  "reabertoPorNome" TEXT,
  "motivoReabertura" TEXT,
  CONSTRAINT "FechamentoCaixa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FechamentoCaixa_mes_check" CHECK ("mes" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
-- Um mês só pode ter um fechamento vigente; reaberturas ficam como histórico.
CREATE UNIQUE INDEX "FechamentoCaixa_mes_vigente_key" ON "FechamentoCaixa"("mes") WHERE "reabertoEm" IS NULL;
CREATE INDEX "FechamentoCaixa_mes_idx" ON "FechamentoCaixa"("mes");

COMMIT;
