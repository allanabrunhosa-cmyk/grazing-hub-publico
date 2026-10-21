-- Módulo de etiquetas: prazos definidos pela operação, snapshots imutáveis e
-- distinção explícita entre preparo, exportação, envio e confirmação física.

CREATE TYPE "ConservacaoEtiqueta" AS ENUM ('REFRIGERADO', 'CONGELADO');
CREATE TYPE "TamanhoEtiqueta" AS ENUM ('MM_60X40', 'MM_60X60');
CREATE TYPE "StatusTrabalhoEtiqueta" AS ENUM (
  'PREPARADO',
  'ENVIANDO',
  'ENVIADO_AO_DISPOSITIVO',
  'ENVIO_INCERTO',
  'EXPORTADO',
  'FALHA',
  'CONFIRMADO_PELO_OPERADOR'
);
CREATE TYPE "TransporteEtiqueta" AS ENUM ('ZEBRA_BROWSER_PRINT', 'ARQUIVO_ZPL');
CREATE TYPE "ResultadoTentativaEtiqueta" AS ENUM ('INICIADA', 'SUCESSO', 'FALHA', 'INCERTO');

ALTER TABLE "ConfiguracaoLoja"
  ADD COLUMN "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN "maximoCopiasEtiqueta" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "Insumo"
  ADD COLUMN "etiquetaHabilitada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "validadeRefrigeradoDias" INTEGER,
  ADD COLUMN "validadeCongeladoDias" INTEGER,
  ADD COLUMN "conservacaoEtiquetaPadrao" "ConservacaoEtiqueta",
  ADD COLUMN "versaoConfiguracaoEtiqueta" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "etiquetaAtualizadaPorId" TEXT;

CREATE TABLE "PerfilImpressora" (
  "id" TEXT NOT NULL,
  "lojaId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "fabricante" TEXT NOT NULL DEFAULT 'Zebra',
  "modelo" TEXT,
  "dpi" INTEGER NOT NULL DEFAULT 203,
  "linguagem" TEXT NOT NULL DEFAULT 'ZPL',
  "suporta60x40" BOOLEAN NOT NULL DEFAULT true,
  "suporta60x60" BOOLEAN NOT NULL DEFAULT true,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerfilImpressora_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrabalhoEtiqueta" (
  "id" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "lojaId" TEXT NOT NULL,
  "insumoId" TEXT NOT NULL,
  "produtoNome" TEXT NOT NULL,
  "categoriaNome" TEXT,
  "unidade" TEXT NOT NULL,
  "prazoDias" INTEGER NOT NULL,
  "configuracaoVersao" INTEGER NOT NULL,
  "lojaNome" TEXT NOT NULL,
  "lojaCnpj" TEXT,
  "fusoHorario" TEXT NOT NULL,
  "resolucaoDpi" INTEGER NOT NULL,
  "conservacao" "ConservacaoEtiqueta" NOT NULL,
  "quantidade" DECIMAL(12,3),
  "lote" TEXT,
  "responsavelManipulacao" TEXT NOT NULL,
  "emitidoPorId" TEXT NOT NULL,
  "manipuladoEm" TIMESTAMP(3) NOT NULL,
  "validoAte" TIMESTAMP(3) NOT NULL,
  "tamanho" "TamanhoEtiqueta" NOT NULL,
  "mostrarHora" BOOLEAN NOT NULL DEFAULT true,
  "copias" INTEGER NOT NULL,
  "versaoTemplate" INTEGER NOT NULL DEFAULT 1,
  "zpl" TEXT NOT NULL,
  "hashPayload" TEXT NOT NULL,
  "status" "StatusTrabalhoEtiqueta" NOT NULL DEFAULT 'PREPARADO',
  "confirmadoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrabalhoEtiqueta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TentativaEtiqueta" (
  "id" TEXT NOT NULL,
  "trabalhoId" TEXT NOT NULL,
  "perfilImpressoraId" TEXT,
  "solicitadoPorId" TEXT NOT NULL,
  "transporte" "TransporteEtiqueta" NOT NULL,
  "resultado" "ResultadoTentativaEtiqueta" NOT NULL,
  "dispositivoNome" TEXT,
  "erro" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizadoEm" TIMESTAMP(3),
  CONSTRAINT "TentativaEtiqueta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventoAuditoriaEtiqueta" (
  "id" TEXT NOT NULL,
  "lojaId" TEXT NOT NULL,
  "entidade" TEXT NOT NULL,
  "entidadeId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "detalhes" JSONB,
  "usuarioId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoAuditoriaEtiqueta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrabalhoEtiqueta_lojaId_chaveIdempotencia_key" ON "TrabalhoEtiqueta"("lojaId", "chaveIdempotencia");
CREATE INDEX "Insumo_etiquetaHabilitada_tipo_idx" ON "Insumo"("etiquetaHabilitada", "tipo");
CREATE INDEX "PerfilImpressora_lojaId_ativo_idx" ON "PerfilImpressora"("lojaId", "ativo");
CREATE INDEX "TrabalhoEtiqueta_lojaId_createdAt_idx" ON "TrabalhoEtiqueta"("lojaId", "createdAt");
CREATE INDEX "TrabalhoEtiqueta_insumoId_createdAt_idx" ON "TrabalhoEtiqueta"("insumoId", "createdAt");
CREATE INDEX "TrabalhoEtiqueta_emitidoPorId_createdAt_idx" ON "TrabalhoEtiqueta"("emitidoPorId", "createdAt");
CREATE INDEX "TentativaEtiqueta_trabalhoId_createdAt_idx" ON "TentativaEtiqueta"("trabalhoId", "createdAt");
CREATE INDEX "TentativaEtiqueta_solicitadoPorId_createdAt_idx" ON "TentativaEtiqueta"("solicitadoPorId", "createdAt");
CREATE INDEX "EventoAuditoriaEtiqueta_lojaId_createdAt_idx" ON "EventoAuditoriaEtiqueta"("lojaId", "createdAt");
CREATE INDEX "EventoAuditoriaEtiqueta_entidade_entidadeId_idx" ON "EventoAuditoriaEtiqueta"("entidade", "entidadeId");

ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_etiquetaAtualizadaPorId_fkey" FOREIGN KEY ("etiquetaAtualizadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerfilImpressora" ADD CONSTRAINT "PerfilImpressora_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrabalhoEtiqueta" ADD CONSTRAINT "TrabalhoEtiqueta_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrabalhoEtiqueta" ADD CONSTRAINT "TrabalhoEtiqueta_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrabalhoEtiqueta" ADD CONSTRAINT "TrabalhoEtiqueta_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TentativaEtiqueta" ADD CONSTRAINT "TentativaEtiqueta_trabalhoId_fkey" FOREIGN KEY ("trabalhoId") REFERENCES "TrabalhoEtiqueta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TentativaEtiqueta" ADD CONSTRAINT "TentativaEtiqueta_perfilImpressoraId_fkey" FOREIGN KEY ("perfilImpressoraId") REFERENCES "PerfilImpressora"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TentativaEtiqueta" ADD CONSTRAINT "TentativaEtiqueta_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoAuditoriaEtiqueta" ADD CONSTRAINT "EventoAuditoriaEtiqueta_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoAuditoriaEtiqueta" ADD CONSTRAINT "EventoAuditoriaEtiqueta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConfiguracaoLoja" ADD CONSTRAINT "ConfiguracaoLoja_maximoCopiasEtiqueta_check" CHECK ("maximoCopiasEtiqueta" BETWEEN 1 AND 50);
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_validadeRefrigeradoDias_check" CHECK ("validadeRefrigeradoDias" IS NULL OR "validadeRefrigeradoDias" > 0);
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_validadeCongeladoDias_check" CHECK ("validadeCongeladoDias" IS NULL OR "validadeCongeladoDias" > 0);
ALTER TABLE "PerfilImpressora" ADD CONSTRAINT "PerfilImpressora_dpi_check" CHECK ("dpi" BETWEEN 100 AND 1200);
ALTER TABLE "TrabalhoEtiqueta" ADD CONSTRAINT "TrabalhoEtiqueta_prazoDias_check" CHECK ("prazoDias" > 0);
ALTER TABLE "TrabalhoEtiqueta" ADD CONSTRAINT "TrabalhoEtiqueta_copias_check" CHECK ("copias" > 0);
ALTER TABLE "TrabalhoEtiqueta" ADD CONSTRAINT "TrabalhoEtiqueta_resolucaoDpi_check" CHECK ("resolucaoDpi" BETWEEN 100 AND 1200);
