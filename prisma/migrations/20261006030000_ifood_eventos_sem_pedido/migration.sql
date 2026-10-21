-- Eventos futuros ou de loja também precisam de retenção e ACK durável.
ALTER TABLE "EventoIfood" ALTER COLUMN "pedidoExternoId" DROP NOT NULL;
