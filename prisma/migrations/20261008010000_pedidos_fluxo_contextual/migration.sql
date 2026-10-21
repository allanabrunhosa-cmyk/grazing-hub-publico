-- Configuração anterior à operação; nenhuma reclassificação ou liberação de integração.
ALTER TABLE "CanalVenda" ADD COLUMN "categoriaDevolucaoId" TEXT;
ALTER TABLE "CanalVenda" ADD CONSTRAINT "CanalVenda_categoriaDevolucaoId_fkey"
  FOREIGN KEY ("categoriaDevolucaoId") REFERENCES "CategoriaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LojaIfood" ADD COLUMN "financeiroConfig" JSONB;
ALTER TABLE "LojaIfood" ADD COLUMN "versaoFinanceiroConfig" INTEGER NOT NULL DEFAULT 1;
