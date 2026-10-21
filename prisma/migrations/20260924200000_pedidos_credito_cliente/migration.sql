ALTER TABLE "LancamentoFinanceiro" ADD COLUMN "pedidoQuitadoCredito" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "LancamentoFinanceiro" DROP CONSTRAINT "LancamentoFinanceiro_pedido_campos_check";
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_pedido_campos_check" CHECK (
  ("pedidoVendaId" IS NULL AND "pedidoEfeitoChave" IS NULL AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL AND NOT "pedidoQuitadoCredito")
  OR ("pedidoVendaId" IS NOT NULL AND "pedidoEfeitoChave" IS NOT NULL AND (
    ("tipo" = 'RECEITA' AND "pedidoParcelaRaiz" IS NOT NULL AND "pedidoValorOriginal" > 0 AND "pedidoFormaSnapshot" IS NOT NULL AND ((NOT "pedidoQuitadoCredito" AND "formaPagamentoVendaId" IS NOT NULL) OR ("pedidoQuitadoCredito" AND "formaPagamentoVendaId" IS NULL AND "pedidoEfeitoChave" LIKE 'credito:%')))
    OR ("tipo" = 'DESPESA' AND NOT "pedidoQuitadoCredito" AND ("pedidoEfeitoChave" LIKE 'taxa-repasse:%' OR "pedidoEfeitoChave" LIKE 'devolucao:%') AND "pedidoParcelaRaiz" IS NULL AND "pedidoValorOriginal" IS NULL AND "formaPagamentoVendaId" IS NULL AND "pedidoFormaSnapshot" IS NULL)
  ))
);

CREATE TABLE "CreditoClienteMovimento" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "tratamentoId" TEXT,
  "pedidoAplicacaoId" TEXT,
  "origemMovimentoId" TEXT,
  "motivo" TEXT,
  "referenciaComunicacao" TEXT,
  "data" TIMESTAMP(3) NOT NULL,
  "chaveOperacao" TEXT NOT NULL,
  "hashOperacao" TEXT NOT NULL,
  "criadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditoClienteMovimento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreditoClienteMovimento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "ClienteVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CreditoClienteMovimento_tratamentoId_fkey" FOREIGN KEY ("tratamentoId") REFERENCES "TratamentoFinanceiroPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CreditoClienteMovimento_pedidoAplicacaoId_fkey" FOREIGN KEY ("pedidoAplicacaoId") REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CreditoClienteMovimento_origemMovimentoId_fkey" FOREIGN KEY ("origemMovimentoId") REFERENCES "CreditoClienteMovimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CreditoClienteMovimento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CreditoClienteMovimento_valor_check" CHECK ("valor" > 0),
  CONSTRAINT "CreditoClienteMovimento_tipo_check" CHECK ("tipo" IN ('CONCESSAO','APLICACAO','LIBERACAO','AJUSTE_CREDITO','AJUSTE_DEBITO')),
  CONSTRAINT "CreditoClienteMovimento_origem_check" CHECK (("tipo" = 'CONCESSAO' AND "tratamentoId" IS NOT NULL) OR ("tipo" = 'APLICACAO' AND "pedidoAplicacaoId" IS NOT NULL) OR ("tipo" IN ('LIBERACAO','AJUSTE_CREDITO','AJUSTE_DEBITO') AND "origemMovimentoId" IS NOT NULL))
);
CREATE UNIQUE INDEX "CreditoClienteMovimento_chaveOperacao_key" ON "CreditoClienteMovimento"("chaveOperacao");
CREATE UNIQUE INDEX "CreditoClienteMovimento_concessao_unica" ON "CreditoClienteMovimento"("tratamentoId") WHERE "tipo" = 'CONCESSAO';
CREATE UNIQUE INDEX "CreditoClienteMovimento_aplicacao_unica" ON "CreditoClienteMovimento"("pedidoAplicacaoId") WHERE "tipo" = 'APLICACAO';
CREATE INDEX "CreditoClienteMovimento_clienteId_createdAt_idx" ON "CreditoClienteMovimento"("clienteId", "createdAt");
CREATE INDEX "CreditoClienteMovimento_tratamentoId_idx" ON "CreditoClienteMovimento"("tratamentoId");
CREATE INDEX "CreditoClienteMovimento_pedidoAplicacaoId_idx" ON "CreditoClienteMovimento"("pedidoAplicacaoId");
CREATE INDEX "CreditoClienteMovimento_origemMovimentoId_idx" ON "CreditoClienteMovimento"("origemMovimentoId");
