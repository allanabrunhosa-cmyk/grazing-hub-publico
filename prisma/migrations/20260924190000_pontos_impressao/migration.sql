CREATE TYPE "EstadoEnvioPonto" AS ENUM ('PENDENTE', 'RESERVADO', 'ENVIADO_USB', 'FALHA', 'INCERTO', 'CONFIRMADO');

CREATE TABLE "PontoImpressao" (
  "id" TEXT NOT NULL, "lojaId" TEXT NOT NULL, "nome" TEXT NOT NULL,
  "icone" TEXT NOT NULL DEFAULT 'impressora', "ativo" BOOLEAN NOT NULL DEFAULT true,
  "padrao" BOOLEAN NOT NULL DEFAULT false, "impressoraSelecionadaId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PontoImpressao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PontoImpressao_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PontoImpressao_lojaId_ativo_idx" ON "PontoImpressao"("lojaId", "ativo");
CREATE UNIQUE INDEX "PontoImpressao_um_padrao_por_loja" ON "PontoImpressao"("lojaId") WHERE "padrao" = true;

CREATE TYPE "EstadoMudancaWifiPonto" AS ENUM ('PENDENTE', 'ENTREGUE', 'CONFIRMADA', 'REVERTIDA', 'FALHA', 'EXPIRADA');
CREATE TABLE "MudancaWifiPonto" (
  "id" TEXT NOT NULL, "pontoId" TEXT NOT NULL, "ssid" TEXT NOT NULL,
  "segredoCifrado" TEXT, "estado" "EstadoMudancaWifiPonto" NOT NULL DEFAULT 'PENDENTE',
  "expiraEm" TIMESTAMP(3) NOT NULL, "entregueEm" TIMESTAMP(3),
  "finalizadoEm" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MudancaWifiPonto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MudancaWifiPonto_pontoId_fkey" FOREIGN KEY ("pontoId") REFERENCES "PontoImpressao"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MudancaWifiPonto_pontoId_estado_createdAt_idx" ON "MudancaWifiPonto"("pontoId", "estado", "createdAt");
CREATE UNIQUE INDEX "MudancaWifiPonto_uma_pendente" ON "MudancaWifiPonto"("pontoId") WHERE "estado" IN ('PENDENTE', 'ENTREGUE');

CREATE TABLE "CodigoVinculoImpressao" (
  "id" TEXT NOT NULL, "lojaId" TEXT NOT NULL, "pontoId" TEXT NOT NULL,
  "codigoHash" TEXT NOT NULL, "tentativas" INTEGER NOT NULL DEFAULT 0,
  "expiraEm" TIMESTAMP(3) NOT NULL, "usadoEm" TIMESTAMP(3), "criadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CodigoVinculoImpressao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CodigoVinculoImpressao_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CodigoVinculoImpressao_pontoId_fkey" FOREIGN KEY ("pontoId") REFERENCES "PontoImpressao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CodigoVinculoImpressao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CodigoVinculoImpressao_codigoHash_key" ON "CodigoVinculoImpressao"("codigoHash");
CREATE INDEX "CodigoVinculoImpressao_pontoId_expiraEm_idx" ON "CodigoVinculoImpressao"("pontoId", "expiraEm");

CREATE TABLE "LimiteVinculoImpressao" (
  "chave" TEXT NOT NULL, "tentativas" INTEGER NOT NULL DEFAULT 0,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LimiteVinculoImpressao_pkey" PRIMARY KEY ("chave")
);
CREATE INDEX "LimiteVinculoImpressao_expiraEm_idx" ON "LimiteVinculoImpressao"("expiraEm");

CREATE TABLE "DispositivoImpressao" (
  "id" TEXT NOT NULL, "pontoId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "hostname" TEXT, "modelo" TEXT, "sistema" TEXT, "arquitetura" TEXT,
  "usbImpressoras" JSONB, "impressoraDetectada" BOOLEAN NOT NULL DEFAULT false,
  "wifiSsid" TEXT, "wifiFrequenciaMhz" INTEGER, "wifiRedes" JSONB, "wifiEndereco" TEXT,
  "ethernetEndereco" TEXT, "vistoEm" TIMESTAMP(3), "revogadoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DispositivoImpressao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DispositivoImpressao_pontoId_fkey" FOREIGN KEY ("pontoId") REFERENCES "PontoImpressao"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DispositivoImpressao_pontoId_key" ON "DispositivoImpressao"("pontoId");
CREATE UNIQUE INDEX "DispositivoImpressao_tokenHash_key" ON "DispositivoImpressao"("tokenHash");

CREATE TABLE "EnvioPontoImpressao" (
  "id" TEXT NOT NULL, "lojaId" TEXT NOT NULL, "pontoId" TEXT NOT NULL,
  "trabalhoId" TEXT, "solicitadoPorId" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL, "tipo" TEXT NOT NULL DEFAULT 'ETIQUETA', "reimpressao" BOOLEAN NOT NULL DEFAULT false,
  "zpl" TEXT NOT NULL, "estado" "EstadoEnvioPonto" NOT NULL DEFAULT 'PENDENTE',
  "reservadaEm" TIMESTAMP(3), "reservaAte" TIMESTAMP(3),
  "finalizadoEm" TIMESTAMP(3), "confirmadoEm" TIMESTAMP(3), "confirmadoPorId" TEXT, "detalhe" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnvioPontoImpressao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EnvioPontoImpressao_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnvioPontoImpressao_pontoId_fkey" FOREIGN KEY ("pontoId") REFERENCES "PontoImpressao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnvioPontoImpressao_trabalhoId_fkey" FOREIGN KEY ("trabalhoId") REFERENCES "TrabalhoEtiqueta"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnvioPontoImpressao_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnvioPontoImpressao_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EnvioPontoImpressao_lojaId_chaveIdempotencia_key" ON "EnvioPontoImpressao"("lojaId", "chaveIdempotencia");
CREATE UNIQUE INDEX "EnvioPontoImpressao_um_primeiro_envio" ON "EnvioPontoImpressao"("trabalhoId") WHERE "trabalhoId" IS NOT NULL AND "reimpressao" = false;
CREATE INDEX "EnvioPontoImpressao_pontoId_estado_createdAt_idx" ON "EnvioPontoImpressao"("pontoId", "estado", "createdAt");
CREATE INDEX "EnvioPontoImpressao_trabalhoId_createdAt_idx" ON "EnvioPontoImpressao"("trabalhoId", "createdAt");
