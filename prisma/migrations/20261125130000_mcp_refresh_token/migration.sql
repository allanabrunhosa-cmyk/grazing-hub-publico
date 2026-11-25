-- Aditiva. Renovação do acesso MCP sem novo consentimento (refresh token com rotação).
-- Somente hashes são guardados. "familia" liga os tokens derivados do mesmo consentimento,
-- para invalidar a cadeia inteira quando um refresh já usado reaparece.
CREATE TABLE "McpRefreshToken" (
  "hash" TEXT PRIMARY KEY, "familia" TEXT NOT NULL,
  "autorizacaoId" TEXT NOT NULL REFERENCES "McpAutorizacao"("id") ON DELETE RESTRICT,
  "versao" INTEGER NOT NULL, "sessaoVersao" INTEGER NOT NULL, "permissoesHash" TEXT NOT NULL,
  "escopos" TEXT[] NOT NULL, "restricoes" JSONB NOT NULL, "emissor" TEXT NOT NULL, "destinatario" TEXT NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL, "consumidoEm" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "McpRefreshToken_expiraEm_idx" ON "McpRefreshToken"("expiraEm");
CREATE INDEX "McpRefreshToken_familia_idx" ON "McpRefreshToken"("familia");
-- Tokens de acesso anteriores ficam sem família: seguem válidos até vencer e não são renováveis.
ALTER TABLE "McpToken" ADD COLUMN "familia" TEXT;
CREATE INDEX "McpToken_familia_idx" ON "McpToken"("familia");
