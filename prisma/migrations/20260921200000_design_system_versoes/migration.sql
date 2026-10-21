-- Central de Design: rascunho compartilhado, snapshots publicados e auditoria.
-- A migration é aditiva; a operação continua usando os valores de fábrica até a primeira publicação.

CREATE TYPE "TipoVersaoDesign" AS ENUM ('PUBLICACAO', 'RESTAURACAO');
CREATE TYPE "AcaoEventoDesign" AS ENUM ('RASCUNHO_SALVO', 'PUBLICADO', 'RESTAURADO');

CREATE TABLE "ConfiguracaoDesign" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "lojaId" TEXT NOT NULL DEFAULT 'singleton',
  "versaoPublicadaId" TEXT,
  "revisaoPublicada" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfiguracaoDesign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RascunhoDesign" (
  "id" TEXT NOT NULL,
  "configuracaoId" TEXT NOT NULL,
  "valores" JSONB NOT NULL,
  "revisao" INTEGER NOT NULL DEFAULT 1,
  "versaoBase" INTEGER NOT NULL DEFAULT 0,
  "autorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RascunhoDesign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VersaoDesign" (
  "id" TEXT NOT NULL,
  "configuracaoId" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "valores" JSONB NOT NULL,
  "schemaVersao" INTEGER NOT NULL DEFAULT 1,
  "tipo" "TipoVersaoDesign" NOT NULL,
  "motivo" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "versaoOrigemId" TEXT,
  "chaveIdempotencia" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VersaoDesign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventoDesign" (
  "id" TEXT NOT NULL,
  "configuracaoId" TEXT NOT NULL,
  "acao" "AcaoEventoDesign" NOT NULL,
  "autorId" TEXT NOT NULL,
  "revisao" INTEGER,
  "versaoId" TEXT,
  "detalhes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoDesign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracaoDesign_lojaId_key" ON "ConfiguracaoDesign"("lojaId");
CREATE UNIQUE INDEX "ConfiguracaoDesign_versaoPublicadaId_key" ON "ConfiguracaoDesign"("versaoPublicadaId");
CREATE UNIQUE INDEX "RascunhoDesign_configuracaoId_key" ON "RascunhoDesign"("configuracaoId");
CREATE UNIQUE INDEX "VersaoDesign_chaveIdempotencia_key" ON "VersaoDesign"("chaveIdempotencia");
CREATE UNIQUE INDEX "VersaoDesign_configuracaoId_numero_key" ON "VersaoDesign"("configuracaoId", "numero");
CREATE INDEX "VersaoDesign_configuracaoId_createdAt_idx" ON "VersaoDesign"("configuracaoId", "createdAt");
CREATE INDEX "EventoDesign_configuracaoId_createdAt_idx" ON "EventoDesign"("configuracaoId", "createdAt");

ALTER TABLE "ConfiguracaoDesign" ADD CONSTRAINT "ConfiguracaoDesign_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfiguracaoDesign" ADD CONSTRAINT "ConfiguracaoDesign_versaoPublicadaId_fkey" FOREIGN KEY ("versaoPublicadaId") REFERENCES "VersaoDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RascunhoDesign" ADD CONSTRAINT "RascunhoDesign_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "ConfiguracaoDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RascunhoDesign" ADD CONSTRAINT "RascunhoDesign_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VersaoDesign" ADD CONSTRAINT "VersaoDesign_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "ConfiguracaoDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VersaoDesign" ADD CONSTRAINT "VersaoDesign_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VersaoDesign" ADD CONSTRAINT "VersaoDesign_versaoOrigemId_fkey" FOREIGN KEY ("versaoOrigemId") REFERENCES "VersaoDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoDesign" ADD CONSTRAINT "EventoDesign_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "ConfiguracaoDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoDesign" ADD CONSTRAINT "EventoDesign_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
