CREATE TABLE "DocumentoFiscalSaida" (
 "id" TEXT PRIMARY KEY, "pedidoId" TEXT NOT NULL REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "versaoPedido" INTEGER NOT NULL, "versaoPayload" INTEGER NOT NULL DEFAULT 1, "payload" JSONB NOT NULL, "hashPayload" TEXT NOT NULL,
 "criadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "criadoPorNome" TEXT NOT NULL,
 "ambiente" TEXT NOT NULL DEFAULT 'NAO_CONFIGURADO', "provedor" TEXT, "status" TEXT NOT NULL DEFAULT 'SEM_EMISSOR',
 "acao" TEXT, "tentativas" INTEGER NOT NULL DEFAULT 0, "proximaTentativa" TIMESTAMP(3), "leaseToken" TEXT, "leaseAte" TIMESTAMP(3), "ultimoErro" TEXT,
 "referenciaProvedor" TEXT, "ultimaSequencia" INTEGER NOT NULL DEFAULT -1,
 "chaveFiscal" TEXT, "numero" TEXT, "serie" TEXT, "protocolo" TEXT, "xml" TEXT, "pdf" BYTEA, "motivoCancelamento" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "DocumentoFiscalSaida_estado_check" CHECK ("status" IN ('SEM_EMISSOR','PREPARADO','PROCESSANDO','INCERTO','PENDENTE_CONFERENCIA','AUTORIZADO','REJEITADO','CANCELADO')),
 CONSTRAINT "DocumentoFiscalSaida_acao_check" CHECK ("acao" IS NULL OR "acao" IN ('ENVIAR','CONSULTAR','CANCELAR'))
);
CREATE UNIQUE INDEX "DocumentoFiscalSaida_pedidoId_versaoPedido_key" ON "DocumentoFiscalSaida"("pedidoId","versaoPedido");
CREATE UNIQUE INDEX "DocumentoFiscalSaida_provedor_ambiente_referenciaProvedor_key" ON "DocumentoFiscalSaida"("provedor","ambiente","referenciaProvedor");
CREATE INDEX "DocumentoFiscalSaida_acao_proximaTentativa_idx" ON "DocumentoFiscalSaida"("acao","proximaTentativa");
CREATE TABLE "EventoFiscalSaida" (
 "id" TEXT PRIMARY KEY, "documentoId" TEXT NOT NULL REFERENCES "DocumentoFiscalSaida"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "chave" TEXT NOT NULL UNIQUE, "tipo" TEXT NOT NULL, "dados" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EventoFiscalSaida_documentoId_createdAt_idx" ON "EventoFiscalSaida"("documentoId","createdAt");
