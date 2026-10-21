-- Mantém oculto o histórico anterior ao recorte, salvo inclusão manual explícita.
ALTER TABLE "NotaFiscalServico" ADD COLUMN "importadaManualmente" BOOLEAN NOT NULL DEFAULT false;
