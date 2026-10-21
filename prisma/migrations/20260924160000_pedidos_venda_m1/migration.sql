CREATE TABLE "PedidoVenda" (
  "id" TEXT NOT NULL,
  "numero" SERIAL NOT NULL,
  "clienteId" TEXT,
  "canalId" TEXT,
  "canalNomeSnapshot" TEXT,
  "origem" TEXT NOT NULL DEFAULT 'INTERNO',
  "chaveCriacao" TEXT NOT NULL,
  "hashCriacao" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
  "versao" INTEGER NOT NULL DEFAULT 1,
  "atendimento" TEXT,
  "prazo" TEXT,
  "previsaoData" DATE,
  "previsaoJanela" TEXT,
  "confirmadoEm" TIMESTAMP(3),
  "entregueEm" TIMESTAMP(3),
  "canceladoEm" TIMESTAMP(3),
  "rascunho" JSONB,
  "compradorSnapshot" JSONB,
  "destinatarioSnapshot" JSONB,
  "enderecoSnapshot" JSONB,
  "observacoes" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "frete" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "criadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PedidoVenda_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PedidoVenda_status_check" CHECK ("status" IN ('RASCUNHO', 'CONFIRMADO', 'CANCELADO')),
  CONSTRAINT "PedidoVenda_versao_check" CHECK ("versao" > 0),
  CONSTRAINT "PedidoVenda_valores_check" CHECK ("subtotal" >= 0 AND "desconto" >= 0 AND "frete" >= 0 AND "total" >= 0)
);

CREATE TABLE "ItemPedidoVenda" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "versaoPedido" INTEGER NOT NULL,
  "ordem" INTEGER NOT NULL,
  "vigente" BOOLEAN NOT NULL DEFAULT true,
  "quantidade" DECIMAL(20,6) NOT NULL,
  "unidadeSnapshot" TEXT NOT NULL,
  "produtoSnapshot" JSONB NOT NULL,
  "escolhasSnapshot" JSONB NOT NULL,
  "composicaoSnapshot" JSONB,
  "estadoComposicao" TEXT NOT NULL,
  "precoOriginal" DECIMAL(14,2) NOT NULL,
  "precoAplicado" DECIMAL(14,2) NOT NULL,
  "acrescimos" DECIMAL(14,2) NOT NULL,
  "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalLinha" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "ItemPedidoVenda_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ItemPedidoVenda_quantidade_check" CHECK ("quantidade" > 0),
  CONSTRAINT "ItemPedidoVenda_valores_check" CHECK ("precoOriginal" >= 0 AND "precoAplicado" >= 0 AND "acrescimos" >= 0 AND "desconto" >= 0 AND "totalLinha" >= 0)
);

CREATE TABLE "HistoricoPedidoVenda" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "chaveOperacao" TEXT NOT NULL,
  "hashOperacao" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "usuarioNome" TEXT NOT NULL,
  "versaoAnterior" INTEGER,
  "versaoNova" INTEGER NOT NULL,
  "motivo" TEXT,
  "antes" JSONB,
  "depois" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricoPedidoVenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PedidoVenda_numero_key" ON "PedidoVenda"("numero");
CREATE UNIQUE INDEX "PedidoVenda_chaveCriacao_key" ON "PedidoVenda"("chaveCriacao");
CREATE INDEX "PedidoVenda_clienteId_createdAt_idx" ON "PedidoVenda"("clienteId", "createdAt");
CREATE INDEX "PedidoVenda_canalId_confirmadoEm_idx" ON "PedidoVenda"("canalId", "confirmadoEm");
CREATE INDEX "PedidoVenda_status_confirmadoEm_idx" ON "PedidoVenda"("status", "confirmadoEm");
CREATE UNIQUE INDEX "ItemPedidoVenda_pedidoId_versaoPedido_ordem_key" ON "ItemPedidoVenda"("pedidoId", "versaoPedido", "ordem");
CREATE INDEX "ItemPedidoVenda_produtoId_idx" ON "ItemPedidoVenda"("produtoId");
CREATE INDEX "ItemPedidoVenda_pedidoId_vigente_idx" ON "ItemPedidoVenda"("pedidoId", "vigente");
CREATE UNIQUE INDEX "HistoricoPedidoVenda_chaveOperacao_key" ON "HistoricoPedidoVenda"("chaveOperacao");
CREATE INDEX "HistoricoPedidoVenda_pedidoId_createdAt_idx" ON "HistoricoPedidoVenda"("pedidoId", "createdAt");

ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "ClienteVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "CanalVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemPedidoVenda" ADD CONSTRAINT "ItemPedidoVenda_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemPedidoVenda" ADD CONSTRAINT "ItemPedidoVenda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistoricoPedidoVenda" ADD CONSTRAINT "HistoricoPedidoVenda_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistoricoPedidoVenda" ADD CONSTRAINT "HistoricoPedidoVenda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
