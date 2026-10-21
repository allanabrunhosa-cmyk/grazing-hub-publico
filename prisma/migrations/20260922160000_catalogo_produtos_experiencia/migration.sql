-- Aditiva: preserva preços, fotos, composições e situação dos produtos existentes.
ALTER TABLE "ProdutoVenda" ADD COLUMN "classificacao" TEXT NOT NULL DEFAULT 'PRINCIPAL', ADD COLUMN "tempoPreparoMinutos" INTEGER;
ALTER TABLE "ProdutoVenda" ADD CONSTRAINT "ProdutoVenda_classificacao_check" CHECK ("classificacao" IN ('PRINCIPAL','OPCAO','COMPLEMENTO')),
  ADD CONSTRAINT "ProdutoVenda_tempo_check" CHECK ("tempoPreparoMinutos" IS NULL OR "tempoPreparoMinutos" >= 0);
ALTER TABLE "PrecoProdutoVenda" ADD COLUMN "precoPromocional" DECIMAL(12,2), ADD CONSTRAINT "PrecoProdutoVenda_promocao_check" CHECK ("precoPromocional" IS NULL OR ("precoPromocional" >= 0 AND "precoPromocional" < "preco"));
ALTER TABLE "ProdutoGrupoVenda" ADD COLUMN "opcoesExcluidas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ComponenteProdutoVenda" ADD COLUMN "observacaoPorcao" TEXT;
-- Congela a regra efetiva atual em cada vínculo. Editar um grupo não muda limites dos produtos.
UPDATE "ProdutoGrupoVenda" v SET "minimo" = g."minimo", "maximo" = g."maximo"
FROM "GrupoComplementoVenda" g WHERE v."grupoId" = g.id AND v."usarPadrao";
UPDATE "ProdutoGrupoVenda" v SET "usarPadrao" = false FROM "GrupoComplementoVenda" g WHERE v."grupoId" = g.id AND g.tipo <> 'EXTRAS';
-- Sem inferir por nomes: cadastros sem categoria, usados só como alternativa de outro produto.
UPDATE "ProdutoVenda" p SET "classificacao" = 'OPCAO'
WHERE NOT EXISTS (SELECT 1 FROM "ProdutoCategoriaVenda" c WHERE c."produtoId" = p.id)
AND EXISTS (SELECT 1 FROM "OpcaoComplementoVenda" o WHERE o."produtoId" = p.id);
