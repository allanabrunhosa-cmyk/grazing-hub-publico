-- Exclusão lógica mantém o status original, os itens e todos os recebimentos.
ALTER TABLE "PedidoCompra" ADD COLUMN "excluidoEm" TIMESTAMP(3);
ALTER TABLE "PedidoCompraHistorico" ADD COLUMN "acao" TEXT NOT NULL DEFAULT 'ALTERACAO_STATUS';
