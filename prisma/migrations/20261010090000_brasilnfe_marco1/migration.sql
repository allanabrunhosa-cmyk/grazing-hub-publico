-- Aditiva. Aplicar somente após revisão, em ambiente autorizado. Marco 1 não opera produção.
CREATE TABLE "ConfiguracaoBrasilNfe" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "lojaId" TEXT NOT NULL DEFAULT 'singleton',
  "ambiente" TEXT NOT NULL DEFAULT 'HOMOLOGACAO',
  "tokenCifrado" TEXT,
  "userTokenCifrado" TEXT,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "diagnostico" JSONB,
  "emitenteHash" TEXT,
  "diagnosticoIniciadoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfiguracaoBrasilNfe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConfiguracaoBrasilNfe_marco1_check" CHECK ("ambiente" = 'HOMOLOGACAO' AND "id" = 'singleton' AND "lojaId" = 'singleton' AND "versao" > 0)
);
CREATE UNIQUE INDEX "ConfiguracaoBrasilNfe_lojaId_key" ON "ConfiguracaoBrasilNfe"("lojaId");
ALTER TABLE "ConfiguracaoBrasilNfe" ADD CONSTRAINT "ConfiguracaoBrasilNfe_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "EventoConfiguracaoBrasilNfe" (
  "id" TEXT NOT NULL,
  "configuracaoId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "dados" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoConfiguracaoBrasilNfe_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventoConfiguracaoBrasilNfe_configuracaoId_createdAt_idx" ON "EventoConfiguracaoBrasilNfe"("configuracaoId", "createdAt");
ALTER TABLE "EventoConfiguracaoBrasilNfe" ADD CONSTRAINT "EventoConfiguracaoBrasilNfe_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "ConfiguracaoBrasilNfe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
