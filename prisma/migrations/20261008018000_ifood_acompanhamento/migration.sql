-- Aditiva: não converte pedidos existentes nem autoriza recepção de loja real.
ALTER TABLE "LojaIfood"
  ADD COLUMN "modoOperacao" TEXT NOT NULL DEFAULT 'OPERACAO',
  ADD COLUMN "pilotoAte" TIMESTAMP(3),
  ADD COLUMN "principalClientId" TEXT,
  ADD COLUMN "pilotoEnquadramentoReferencia" TEXT,
  ADD COLUMN "pilotoPresencaReferencia" TEXT,
  ADD CONSTRAINT "LojaIfood_modoOperacao_check" CHECK ("modoOperacao" IN ('OPERACAO', 'ACOMPANHAMENTO'));
ALTER TABLE "PedidoIfood" ADD COLUMN "acompanhamento" BOOLEAN NOT NULL DEFAULT false;
