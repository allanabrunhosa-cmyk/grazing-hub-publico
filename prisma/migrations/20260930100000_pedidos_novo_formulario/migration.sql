ALTER TABLE "ClienteVenda"
  ADD COLUMN "primeiroNome" TEXT,
  ADD COLUMN "sobrenome" TEXT,
  ADD COLUMN "razaoSocial" TEXT,
  ADD COLUMN "inscricaoEstadual" TEXT,
  ADD COLUMN "dataNascimento" DATE;

ALTER TABLE "PedidoVenda"
  ADD COLUMN "cobrancaSnapshot" JSONB,
  ADD COLUMN "formaPagamentoInformada" TEXT,
  ADD COLUMN "outrosCustos" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "ItemPedidoVenda" ADD COLUMN "observacoes" TEXT;
