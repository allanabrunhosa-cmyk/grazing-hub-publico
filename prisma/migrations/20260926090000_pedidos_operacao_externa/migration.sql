-- Preserva o modo dos pedidos antigos. Somente novas criações explícitas usam EXTERNO.
ALTER TABLE "PedidoVenda"
  ADD COLUMN "modoFinanceiro" TEXT NOT NULL DEFAULT 'HUB',
  ADD COLUMN "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN "referenciaOrigem" TEXT,
  ADD COLUMN "referenciaEstabelecimento" TEXT,
  ADD COLUMN "referenciaPedido" TEXT,
  ADD CONSTRAINT "PedidoVenda_modoFinanceiro_check" CHECK ("modoFinanceiro" IN ('HUB','EXTERNO')),
  ADD CONSTRAINT "PedidoVenda_referencia_completa_check" CHECK (
    ("referenciaOrigem" IS NULL AND "referenciaEstabelecimento" IS NULL AND "referenciaPedido" IS NULL) OR
    ("referenciaOrigem" IS NOT NULL AND "referenciaEstabelecimento" IS NOT NULL AND "referenciaPedido" IS NOT NULL));
CREATE UNIQUE INDEX "PedidoVenda_referenciaOrigem_referenciaEstabelecimento_referen_key"
  ON "PedidoVenda"("referenciaOrigem", "referenciaEstabelecimento", "referenciaPedido");
