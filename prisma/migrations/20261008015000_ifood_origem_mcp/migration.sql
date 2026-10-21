-- Outbox já existente. Vínculo opcional permite retirar acesso MCP também antes
-- do envio externo. Não ativa transporte, lojas ou autoaceites.
ALTER TABLE "AcaoIfood" ADD COLUMN "origemMcpOperacaoId" TEXT;
CREATE INDEX "AcaoIfood_origemMcpOperacaoId_idx" ON "AcaoIfood"("origemMcpOperacaoId");
