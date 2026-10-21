CREATE TABLE "ProducaoPreparacao" (
  "id" TEXT PRIMARY KEY,
  "preparacaoId" TEXT NOT NULL REFERENCES "Insumo"("id") ON DELETE RESTRICT,
  "localId" TEXT NOT NULL REFERENCES "LocalEstoque"("id") ON DELETE RESTRICT,
  "quantidade" DECIMAL(18,6) NOT NULL CHECK ("quantidade" > 0),
  "data" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "motivo" TEXT NOT NULL,
  "chaveOperacao" TEXT NOT NULL UNIQUE,
  "hashOperacao" TEXT NOT NULL,
  "criadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
  "correcao" JSONB,
  "corrigidoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProducaoPreparacao_preparacaoId_data_idx" ON "ProducaoPreparacao"("preparacaoId", "data");
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "producaoPreparacaoId" TEXT REFERENCES "ProducaoPreparacao"("id") ON DELETE RESTRICT;
CREATE INDEX "MovimentacaoEstoque_producaoPreparacaoId_idx" ON "MovimentacaoEstoque"("producaoPreparacaoId");
