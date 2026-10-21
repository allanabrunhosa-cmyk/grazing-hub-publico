ALTER TABLE "LancamentoFinanceiro"
  ADD COLUMN "pedidoVendaId" TEXT,
  ADD COLUMN "pedidoEfeitoChave" TEXT,
  ADD COLUMN "pedidoParcelaRaiz" TEXT,
  ADD COLUMN "pedidoValorOriginal" DECIMAL(14,2),
  ADD COLUMN "formaPagamentoVendaId" TEXT,
  ADD COLUMN "pedidoFormaSnapshot" JSONB;

ALTER TABLE "LancamentoFinanceiro"
  ADD CONSTRAINT "LancamentoFinanceiro_pedido_campos_check" CHECK (
    ("pedidoVendaId" IS NULL AND "pedidoEfeitoChave" IS NULL AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL)
    OR
    ("pedidoVendaId" IS NOT NULL AND "pedidoEfeitoChave" IS NOT NULL AND "pedidoParcelaRaiz" IS NOT NULL AND "pedidoValorOriginal" > 0 AND "formaPagamentoVendaId" IS NOT NULL AND "pedidoFormaSnapshot" IS NOT NULL)
  );

CREATE UNIQUE INDEX "LancamentoFinanceiro_pedidoVendaId_pedidoEfeitoChave_key"
  ON "LancamentoFinanceiro"("pedidoVendaId", "pedidoEfeitoChave");
CREATE INDEX "LancamentoFinanceiro_pedidoVendaId_pedidoParcelaRaiz_idx"
  ON "LancamentoFinanceiro"("pedidoVendaId", "pedidoParcelaRaiz");
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_pedidoVendaId_fkey"
  FOREIGN KEY ("pedidoVendaId") REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_formaPagamentoVendaId_fkey"
  FOREIGN KEY ("formaPagamentoVendaId") REFERENCES "FormaPagamentoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HistoricoFinanceiroPedido" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "chaveOperacao" TEXT NOT NULL,
  "hashOperacao" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "usuarioNome" TEXT NOT NULL,
  "detalhes" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricoFinanceiroPedido_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricoFinanceiroPedido_chaveOperacao_key" ON "HistoricoFinanceiroPedido"("chaveOperacao");
CREATE INDEX "HistoricoFinanceiroPedido_pedidoId_createdAt_idx" ON "HistoricoFinanceiroPedido"("pedidoId", "createdAt");
ALTER TABLE "HistoricoFinanceiroPedido" ADD CONSTRAINT "HistoricoFinanceiroPedido_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistoricoFinanceiroPedido" ADD CONSTRAINT "HistoricoFinanceiroPedido_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
