-- Aditiva: preserva todos os estados anteriores e dados locais.
ALTER TABLE "PedidoVenda" DROP CONSTRAINT "PedidoVenda_status_check";
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_status_check" CHECK ("status" IN ('RASCUNHO','CONFIRMADO','CANCELADO','DECLINADO','ESTORNADO','RECEBIDO_EXTERNO'));
ALTER TABLE "PedidoIfood" ADD COLUMN "disputaCifrada" TEXT, ADD COLUMN "revisaoPendente" BOOLEAN NOT NULL DEFAULT FALSE;
