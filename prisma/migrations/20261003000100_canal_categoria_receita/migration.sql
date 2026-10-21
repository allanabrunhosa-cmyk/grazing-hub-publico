-- Vínculo explícito; nenhum título ou canal histórico é reclassificado.
ALTER TABLE "CanalVenda" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CanalVenda" ADD COLUMN "categoriaReceitaId" TEXT;
ALTER TABLE "CanalVenda" ADD CONSTRAINT "CanalVenda_categoriaReceitaId_fkey"
  FOREIGN KEY ("categoriaReceitaId") REFERENCES "CategoriaFinanceira"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
