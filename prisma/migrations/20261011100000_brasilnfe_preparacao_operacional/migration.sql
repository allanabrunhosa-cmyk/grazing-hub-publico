-- Aditiva: aplicação somente nos bancos locais isolados desta preparação.
ALTER TABLE "DocumentoFiscalSaida"
 ADD COLUMN "ultimaSequenciaObservada" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "modeloDocumento" INTEGER,
 ADD COLUMN "protocoloCancelamento" TEXT,
 ADD COLUMN "cancelamentoPendente" BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN "xmlCancelamento" TEXT,
 ADD COLUMN "html" TEXT,
 ADD CONSTRAINT "DocumentoFiscalSaida_modeloDocumento_check" CHECK ("modeloDocumento" IS NULL OR "modeloDocumento" IN (55,65)),
 ADD CONSTRAINT "DocumentoFiscalSaida_observacao_check" CHECK ("ultimaSequenciaObservada" >= 0);
ALTER TABLE "ConfiguracaoBrasilNfe"
 ADD COLUMN "preRequisitos" JSONB,
 ADD COLUMN "preRequisitosEmitenteHash" TEXT,
 ADD COLUMN "preRequisitosIniciadoEm" TIMESTAMP(3);
