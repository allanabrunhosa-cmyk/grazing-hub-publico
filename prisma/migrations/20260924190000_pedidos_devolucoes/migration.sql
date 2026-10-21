ALTER TABLE "LancamentoFinanceiro" DROP CONSTRAINT "LancamentoFinanceiro_pedido_campos_check";
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_pedido_campos_check" CHECK (
  ("pedidoVendaId" IS NULL AND "pedidoEfeitoChave" IS NULL AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL)
  OR ("pedidoVendaId" IS NOT NULL AND "pedidoEfeitoChave" IS NOT NULL AND (
    ("tipo" = 'RECEITA' AND "pedidoParcelaRaiz" IS NOT NULL AND "pedidoValorOriginal" > 0 AND "formaPagamentoVendaId" IS NOT NULL AND "pedidoFormaSnapshot" IS NOT NULL)
    OR ("tipo" = 'DESPESA' AND ("pedidoEfeitoChave" LIKE 'taxa-repasse:%' OR "pedidoEfeitoChave" LIKE 'devolucao:%') AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL)
  ))
);

CREATE TABLE "TratamentoFinanceiroPedido" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "retido" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "motivo" TEXT,
  "referenciaPolitica" TEXT,
  "referenciaComunicacao" TEXT,
  "escolhaClienteEm" TIMESTAMP(3),
  "evidenciaConclusao" TEXT,
  "concluidoEm" TIMESTAMP(3),
  "devolucaoLancamentoId" TEXT,
  "chaveOperacao" TEXT NOT NULL,
  "hashOperacao" TEXT NOT NULL,
  "criadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TratamentoFinanceiroPedido_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TratamentoFinanceiroPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TratamentoFinanceiroPedido_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TratamentoFinanceiroPedido_devolucaoLancamentoId_fkey" FOREIGN KEY ("devolucaoLancamentoId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TratamentoFinanceiroPedido_valores_check" CHECK ("valor" > 0 AND "retido" >= 0),
  CONSTRAINT "TratamentoFinanceiroPedido_tipo_check" CHECK ("tipo" IN ('DEVOLUCAO','CREDITO')),
  CONSTRAINT "TratamentoFinanceiroPedido_status_check" CHECK ("status" IN ('SOLICITADA','PROCESSANDO','CONCLUIDA','FALHA','CANCELADA'))
);
CREATE UNIQUE INDEX "TratamentoFinanceiroPedido_chaveOperacao_key" ON "TratamentoFinanceiroPedido"("chaveOperacao");
CREATE UNIQUE INDEX "TratamentoFinanceiroPedido_devolucaoLancamentoId_key" ON "TratamentoFinanceiroPedido"("devolucaoLancamentoId");
CREATE INDEX "TratamentoFinanceiroPedido_pedidoId_status_idx" ON "TratamentoFinanceiroPedido"("pedidoId", "status");

CREATE TABLE "AlocacaoTratamentoPedido" (
  "id" TEXT NOT NULL,
  "tratamentoId" TEXT NOT NULL,
  "origemTituloId" TEXT NOT NULL,
  "origemPagamentoExternoId" TEXT,
  "valor" DECIMAL(14,2) NOT NULL,
  "devolucao" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "retencao" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "credito" DECIMAL(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT "AlocacaoTratamentoPedido_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlocacaoTratamentoPedido_tratamentoId_fkey" FOREIGN KEY ("tratamentoId") REFERENCES "TratamentoFinanceiroPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AlocacaoTratamentoPedido_origemTituloId_fkey" FOREIGN KEY ("origemTituloId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AlocacaoTratamentoPedido_origemPagamentoExternoId_fkey" FOREIGN KEY ("origemPagamentoExternoId") REFERENCES "PagamentoExternoPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AlocacaoTratamentoPedido_valores_check" CHECK ("valor" > 0 AND "devolucao" >= 0 AND "retencao" >= 0 AND "credito" >= 0 AND "valor" = "devolucao" + "retencao" + "credito")
);
CREATE INDEX "AlocacaoTratamentoPedido_origemTituloId_idx" ON "AlocacaoTratamentoPedido"("origemTituloId");
CREATE INDEX "AlocacaoTratamentoPedido_origemPagamentoExternoId_idx" ON "AlocacaoTratamentoPedido"("origemPagamentoExternoId");
