-- Recebimento.tipo era um texto solto ("PARCIAL"/"TOTAL") sem garantia de valores
-- válidos — vira enum, seguindo o padrão já usado no resto do schema.
-- Seguro: tabela ainda vazia, nenhuma linha de aplicação grava em Recebimento hoje.
CREATE TYPE "TipoRecebimento" AS ENUM ('PARCIAL', 'TOTAL');
ALTER TABLE "Recebimento" ALTER COLUMN "tipo" TYPE "TipoRecebimento" USING "tipo"::"TipoRecebimento";

-- Quem recebe fisicamente a mercadoria pode não ter login no sistema.
ALTER TABLE "Recebimento" ADD COLUMN "responsavelNome" TEXT NOT NULL;

-- O fluxo de criação de pedido nunca exige preço no momento do pedido — fica opcional,
-- pré-preenchido na UI a partir da Cotação mais recente ou do custo médio do Insumo.
ALTER TABLE "PedidoCompraItem" ALTER COLUMN "precoUnitario" DROP NOT NULL;
ALTER TABLE "PedidoCompraItem" ALTER COLUMN "precoTotal" DROP NOT NULL;
