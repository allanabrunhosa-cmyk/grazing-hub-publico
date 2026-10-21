ALTER TABLE "NfseDistribuicaoEstado"
  ADD COLUMN "ultimaBuscaAutomaticaEm" TIMESTAMP(3),
  ADD COLUMN "proximaBuscaAutomaticaEm" TIMESTAMP(3),
  ADD COLUMN "resultadoBuscaAutomatica" TEXT;
