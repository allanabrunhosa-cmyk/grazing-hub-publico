ALTER TABLE "SefazDistribuicaoEstado"
ADD COLUMN "nsuConsulta" TEXT NOT NULL DEFAULT '000000000000000',
ADD COLUMN "proximaBuscaEm" TIMESTAMP(3), ADD COLUMN "ultimaExecucaoEm" TIMESTAMP(3), ADD COLUMN "resultadoExecucao" TEXT;
UPDATE "SefazDistribuicaoEstado" SET "nsuConsulta" = "ultNSU";
ALTER TABLE "NotaFiscalRecebida" ADD COLUMN "xmlProximaTentativaEm" TIMESTAMP(3), ADD COLUMN "xmlTentativas" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "xmlUltimoMotivo" TEXT, ADD COLUMN "cienciaJaExistenteEm" TIMESTAMP(3);
CREATE TABLE "SefazLoteRecebido" ("id" TEXT PRIMARY KEY, "cnpj" TEXT NOT NULL, "tipoConsulta" TEXT NOT NULL, "referencia" TEXT NOT NULL, "resposta" JSONB NOT NULL, "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processadoEm" TIMESTAMP(3), "erro" TEXT);
CREATE INDEX "SefazLoteRecebido_cnpj_processadoEm_idx" ON "SefazLoteRecebido"("cnpj", "processadoEm");
CREATE TABLE "SefazDocumentoRecebido" ("id" TEXT PRIMARY KEY, "cnpj" TEXT NOT NULL, "nsu" TEXT NOT NULL, "schema" TEXT NOT NULL, "xml" TEXT NOT NULL, "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "SefazDocumentoRecebido_cnpj_nsu_key" ON "SefazDocumentoRecebido"("cnpj", "nsu");
CREATE TABLE "SefazLacuna" ("id" TEXT PRIMARY KEY, "cnpj" TEXT NOT NULL, "inicio" TEXT NOT NULL, "fim" TEXT NOT NULL, "proximo" TEXT NOT NULL, "tentativas" INTEGER NOT NULL DEFAULT 0, "ultimoMotivo" TEXT, "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "concluidaEm" TIMESTAMP(3));
CREATE UNIQUE INDEX "SefazLacuna_cnpj_inicio_fim_key" ON "SefazLacuna"("cnpj", "inicio", "fim");
CREATE INDEX "SefazLacuna_cnpj_concluidaEm_proximaTentativaEm_idx" ON "SefazLacuna"("cnpj", "concluidaEm", "proximaTentativaEm");
CREATE TABLE "SefazConsultaPontual" ("id" TEXT PRIMARY KEY, "cnpj" TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "SefazConsultaPontual_cnpj_criadaEm_idx" ON "SefazConsultaPontual"("cnpj", "criadaEm");
