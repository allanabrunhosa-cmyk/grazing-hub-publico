-- Compensação explícita; itens importados e histórico permanecem intactos.
ALTER TABLE "ItemFaturaCartao" ADD COLUMN "compensadoComId" TEXT;
CREATE UNIQUE INDEX "ItemFaturaCartao_compensadoComId_key" ON "ItemFaturaCartao"("compensadoComId");
ALTER TABLE "ItemFaturaCartao" ADD CONSTRAINT "ItemFaturaCartao_compensadoComId_fkey" FOREIGN KEY ("compensadoComId") REFERENCES "ItemFaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemFaturaCartao" ADD CONSTRAINT "ItemFaturaCartao_compensacao_sem_autovinculo" CHECK ("compensadoComId" IS NULL OR "compensadoComId" <> "id");
