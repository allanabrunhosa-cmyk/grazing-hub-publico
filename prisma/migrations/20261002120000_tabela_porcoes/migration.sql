-- Amplia somente a escala; preserva os nove dígitos inteiros das fichas existentes.
ALTER TABLE "ComposicaoInsumo" ALTER COLUMN "quantidade" TYPE DECIMAL(18,9);

CREATE TABLE "PorcaoInsumo" (
  "id" TEXT NOT NULL,
  "insumoId" TEXT NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "nomeNormalizado" VARCHAR(120) NOT NULL,
  "quantidade" DECIMAL(18,9) NOT NULL,
  "unidade" "UnidadeMedida" NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "excluidoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PorcaoInsumo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PorcaoInsumo_quantidade_check" CHECK ("quantidade" > 0),
  CONSTRAINT "PorcaoInsumo_versao_check" CHECK ("versao" > 0),
  CONSTRAINT "PorcaoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PorcaoInsumo_insumoId_unidade_nomeNormalizado_key" ON "PorcaoInsumo"("insumoId", "unidade", "nomeNormalizado");
CREATE INDEX "PorcaoInsumo_insumoId_excluidoEm_idx" ON "PorcaoInsumo"("insumoId", "excluidoEm");

CREATE TABLE "HistoricoPorcaoInsumo" (
  "id" TEXT NOT NULL,
  "porcaoId" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "autorNome" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "antes" JSONB,
  "depois" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricoPorcaoInsumo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HistoricoPorcaoInsumo_porcaoId_createdAt_idx" ON "HistoricoPorcaoInsumo"("porcaoId", "createdAt");
