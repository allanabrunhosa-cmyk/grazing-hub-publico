ALTER TABLE "ComponenteProdutoVenda" ADD COLUMN "exibirFicha" BOOLEAN NOT NULL DEFAULT true;

-- Disponibilidade do canal segue o preço-base. Não ativa o cadastro do produto.
UPDATE "PrecoProdutoVenda" SET "ativo" = ("preco" > 0) WHERE "ativo" IS DISTINCT FROM ("preco" > 0);
