-- Aditiva: nenhum pedido, título, item ou vínculo existente é alterado.
CREATE TABLE "AcaoMerchantIfood" (
  "id" TEXT NOT NULL,
  "lojaId" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "corpo" JSONB NOT NULL,
  "antes" JSONB NOT NULL,
  "resultado" JSONB,
  "autorId" TEXT NOT NULL,
  "sessaoVersao" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "proximaTentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadaEm" TIMESTAMP(3),
  "erro" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcaoMerchantIfood_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcaoMerchantIfood_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "LojaIfood"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AcaoMerchantIfood_chave_key" ON "AcaoMerchantIfood"("chave");
CREATE INDEX "AcaoMerchantIfood_estado_proximaTentativa_idx" ON "AcaoMerchantIfood"("estado", "proximaTentativa");
CREATE INDEX "AcaoMerchantIfood_lojaId_createdAt_idx" ON "AcaoMerchantIfood"("lojaId", "createdAt");
