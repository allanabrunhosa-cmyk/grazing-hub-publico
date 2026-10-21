ALTER TABLE "LancamentoFinanceiro" DROP CONSTRAINT "LancamentoFinanceiro_pedido_campos_check";
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_pedido_campos_check" CHECK (
  ("pedidoVendaId" IS NULL AND "pedidoEfeitoChave" IS NULL AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL)
  OR ("pedidoVendaId" IS NOT NULL AND "pedidoEfeitoChave" IS NOT NULL AND (
    ("tipo" = 'RECEITA' AND "pedidoParcelaRaiz" IS NOT NULL AND "pedidoValorOriginal" > 0 AND "formaPagamentoVendaId" IS NOT NULL AND "pedidoFormaSnapshot" IS NOT NULL)
    OR ("tipo" = 'DESPESA' AND "pedidoEfeitoChave" LIKE 'taxa-repasse:%' AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL)
  ))
);

CREATE TABLE "PagamentoExternoPedido" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "tituloId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "valorBruto" DECIMAL(14,2) NOT NULL,
  "parcelasCliente" INTEGER,
  "referenciaExterna" TEXT,
  "documentoExterno" TEXT,
  "vencimentoExterno" DATE,
  "confirmadoEm" TIMESTAMP(3),
  "taxa" DECIMAL(14,2),
  "valorLiquido" DECIMAL(14,2),
  "previsaoRepasse" TIMESTAMP(3),
  "repassadoEm" TIMESTAMP(3),
  "evidencia" TEXT NOT NULL,
  "criadoPorId" TEXT NOT NULL,
  "chaveOperacao" TEXT NOT NULL,
  "hashOperacao" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PagamentoExternoPedido_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PagamentoExternoPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PagamentoExternoPedido_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PagamentoExternoPedido_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PagamentoExternoPedido_valorBruto_check" CHECK ("valorBruto" > 0),
  CONSTRAINT "PagamentoExternoPedido_parcelasCliente_check" CHECK ("parcelasCliente" IS NULL OR "parcelasCliente" BETWEEN 1 AND 4)
);
CREATE UNIQUE INDEX "PagamentoExternoPedido_chaveOperacao_key" ON "PagamentoExternoPedido"("chaveOperacao");
CREATE UNIQUE INDEX "PagamentoExternoPedido_tipo_referenciaExterna_key" ON "PagamentoExternoPedido"("tipo", "referenciaExterna");
CREATE INDEX "PagamentoExternoPedido_pedidoId_status_idx" ON "PagamentoExternoPedido"("pedidoId", "status");
CREATE INDEX "PagamentoExternoPedido_tituloId_status_idx" ON "PagamentoExternoPedido"("tituloId", "status");

CREATE TABLE "RepassePagamentoPedido" (
  "id" TEXT NOT NULL,
  "pagamentoId" TEXT NOT NULL,
  "valorBruto" DECIMAL(14,2) NOT NULL,
  "taxa" DECIMAL(14,2) NOT NULL,
  "valorLiquido" DECIMAL(14,2) NOT NULL,
  "data" TIMESTAMP(3) NOT NULL,
  "contaBancariaId" TEXT NOT NULL,
  "lancamentoId" TEXT NOT NULL,
  "taxaLancamentoId" TEXT,
  "evidencia" TEXT NOT NULL,
  "chaveOperacao" TEXT NOT NULL,
  "hashOperacao" TEXT NOT NULL,
  "criadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepassePagamentoPedido_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepassePagamentoPedido_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "PagamentoExternoPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepassePagamentoPedido_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepassePagamentoPedido_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepassePagamentoPedido_taxaLancamentoId_fkey" FOREIGN KEY ("taxaLancamentoId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepassePagamentoPedido_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepassePagamentoPedido_valores_check" CHECK ("valorBruto" > 0 AND "taxa" >= 0 AND "valorLiquido" >= 0 AND "valorBruto" = "taxa" + "valorLiquido")
);
CREATE UNIQUE INDEX "RepassePagamentoPedido_lancamentoId_key" ON "RepassePagamentoPedido"("lancamentoId");
CREATE UNIQUE INDEX "RepassePagamentoPedido_taxaLancamentoId_key" ON "RepassePagamentoPedido"("taxaLancamentoId");
CREATE UNIQUE INDEX "RepassePagamentoPedido_chaveOperacao_key" ON "RepassePagamentoPedido"("chaveOperacao");
CREATE INDEX "RepassePagamentoPedido_pagamentoId_createdAt_idx" ON "RepassePagamentoPedido"("pagamentoId", "createdAt");
