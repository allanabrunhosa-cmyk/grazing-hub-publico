ALTER TABLE "ProdutoVenda" ADD COLUMN "precoComplemento" DECIMAL(12,2);
ALTER TABLE "OpcaoComplementoVenda" ADD COLUMN "composicao" JSONB;
ALTER TABLE "ProdutoGrupoVenda" ADD COLUMN "ajustesOpcoes" JSONB;
