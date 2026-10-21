-- Vínculo técnico aditivo. Envios anteriores e dos demais canais permanecem iguais.
ALTER TABLE "EnvioPontoImpressao" ADD COLUMN "origemMcpOperacaoId" TEXT;
CREATE INDEX "EnvioPontoImpressao_origemMcpOperacaoId_idx" ON "EnvioPontoImpressao"("origemMcpOperacaoId");
