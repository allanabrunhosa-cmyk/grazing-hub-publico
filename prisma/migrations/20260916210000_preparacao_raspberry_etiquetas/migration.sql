-- Preparação opcional de estação: não habilita transporte nem altera perfis existentes.
ALTER TABLE "PerfilImpressora" ADD COLUMN "planejamentoRaspberry" JSONB;
CREATE INDEX "TrabalhoEtiqueta_lojaId_validoAte_id_idx" ON "TrabalhoEtiqueta"("lojaId", "validoAte", "id");
