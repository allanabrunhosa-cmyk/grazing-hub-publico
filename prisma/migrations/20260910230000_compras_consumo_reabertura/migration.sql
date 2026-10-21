ALTER TABLE "PedidoCompra" ALTER COLUMN "fornecedorId" DROP NOT NULL;
ALTER TABLE "PedidoCompra" ADD COLUMN "fornecedorAvulso" TEXT,
  ADD COLUMN "usoConsumo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PedidoCompraItem" ALTER COLUMN "insumoId" DROP NOT NULL;
ALTER TABLE "PedidoCompraItem" ADD COLUMN "descricao" TEXT,
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Recebimento" ADD COLUMN "reabertoEm" TIMESTAMP(3);

ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedor_valido" CHECK (
  ("fornecedorId" IS NOT NULL AND "fornecedorAvulso" IS NULL)
  OR ("usoConsumo" AND "fornecedorId" IS NULL AND length(trim("fornecedorAvulso")) > 0 AND "fornecedorAvulso" IS NOT NULL)
);
ALTER TABLE "PedidoCompraItem" ADD CONSTRAINT "PedidoCompraItem_identificacao_valida" CHECK (
  "insumoId" IS NOT NULL OR ("descricao" IS NOT NULL AND length(trim("descricao")) > 0)
);

CREATE TABLE "PedidoCompraHistorico" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pedidoId" TEXT NOT NULL REFERENCES "PedidoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "statusAnterior" "StatusPedidoCompra" NOT NULL,
  "statusNovo" "StatusPedidoCompra" NOT NULL,
  "motivo" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "usuarioNome" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PedidoCompraHistorico_pedidoId_criadoEm_idx" ON "PedidoCompraHistorico"("pedidoId", "criadoEm");
