-- A categoria permanece disponível para consulta histórica, mas deixa de aparecer
-- nas opções de novos lançamentos quando é excluída.
ALTER TABLE "CategoriaFinanceira"
ADD COLUMN "excluidoEm" TIMESTAMP(3);

CREATE INDEX "CategoriaFinanceira_excluidoEm_idx"
ON "CategoriaFinanceira"("excluidoEm");

-- A exclusão lógica libera o nome para um novo cadastro no mesmo nível.
DROP INDEX "CategoriaFinanceira_nome_grupo_paiId_key";
DROP INDEX "CategoriaFinanceira_raiz_nome_grupo_key";

CREATE UNIQUE INDEX "CategoriaFinanceira_nome_grupo_paiId_ativa_key"
ON "CategoriaFinanceira"("nome", "grupo", "paiId")
WHERE "paiId" IS NOT NULL AND "excluidoEm" IS NULL;

CREATE UNIQUE INDEX "CategoriaFinanceira_raiz_nome_grupo_ativa_key"
ON "CategoriaFinanceira"("nome", "grupo")
WHERE "paiId" IS NULL AND "excluidoEm" IS NULL;
