ALTER TABLE "Categoria"
  ADD COLUMN "ordemPorcoes" INTEGER NOT NULL DEFAULT 2147483647,
  ADD COLUMN "versaoOrdemPorcoes" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "HistoricoOrdemCategoriasPorcoes" (
  "id" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "autorNome" TEXT NOT NULL,
  "antes" JSONB NOT NULL,
  "depois" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricoOrdemCategoriasPorcoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HistoricoOrdemCategoriasPorcoes_createdAt_idx"
  ON "HistoricoOrdemCategoriasPorcoes"("createdAt");
