ALTER TABLE "Perda"
  ADD COLUMN "motivoPersonalizado" TEXT,
  ADD COLUMN "unidade" "UnidadeMedida",
  ADD COLUMN "responsavelNome" TEXT,
  ADD COLUMN "excluidaEm" TIMESTAMP(3);

-- Registros legados passam a preservar a unidade e o nome disponíveis nesta migração.
-- Não presume um motivo livre, uma autoria ausente ou uma conversão de unidade.
UPDATE "Perda" p SET "unidade" = i."unidade" FROM "Insumo" i WHERE i.id = p."insumoId";
UPDATE "Perda" p SET "responsavelNome" = u.nome FROM "Usuario" u WHERE u.id = p."responsavelId";
ALTER TABLE "Perda" ALTER COLUMN "unidade" SET NOT NULL;
CREATE INDEX "Perda_excluidaEm_data_idx" ON "Perda"("excluidaEm", "data");

CREATE TABLE "PerdaExclusao" (
  "id" TEXT NOT NULL,
  "perdaId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "responsavelId" TEXT NOT NULL,
  "responsavelNome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "movimentacaoId" TEXT NOT NULL,
  "quantidade" DECIMAL(12,3) NOT NULL,
  "unidade" "UnidadeMedida" NOT NULL,
  CONSTRAINT "PerdaExclusao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PerdaExclusao_motivo_check" CHECK (char_length(btrim("motivo")) BETWEEN 3 AND 1000),
  CONSTRAINT "PerdaExclusao_quantidade_check" CHECK ("quantidade" > 0),
  CONSTRAINT "PerdaExclusao_perdaId_fkey" FOREIGN KEY ("perdaId") REFERENCES "Perda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PerdaExclusao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PerdaExclusao_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "MovimentacaoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PerdaExclusao_perdaId_key" ON "PerdaExclusao"("perdaId");
CREATE UNIQUE INDEX "PerdaExclusao_movimentacaoId_key" ON "PerdaExclusao"("movimentacaoId");
CREATE INDEX "PerdaExclusao_createdAt_idx" ON "PerdaExclusao"("createdAt");
