ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "horariosPedidos" JSONB, ADD COLUMN "versaoHorariosPedidos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PedidoVenda" DROP CONSTRAINT "PedidoVenda_status_check";
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_status_check" CHECK ("status" IN ('RASCUNHO','CONFIRMADO','CANCELADO','DECLINADO','ESTORNADO'));
