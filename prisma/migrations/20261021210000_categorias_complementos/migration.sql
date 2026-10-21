-- Categorias do site e etiquetas internas têm identidades e ordenações próprias.
BEGIN;
ALTER TABLE "CategoriaVenda" ADD COLUMN "escopo" TEXT NOT NULL DEFAULT 'PRODUTO',
  ADD COLUMN "cor" TEXT NOT NULL DEFAULT 'azul';
ALTER TABLE "CategoriaVenda" ADD CONSTRAINT "CategoriaVenda_escopo_check"
  CHECK ("escopo" IN ('PRODUTO', 'COMPLEMENTO'));
ALTER TABLE "CategoriaVenda" ADD CONSTRAINT "CategoriaVenda_cor_check"
  CHECK ("cor" IN ('azul', 'verde', 'amarelo', 'vermelho'));
ALTER TABLE "CategoriaVenda" DROP CONSTRAINT "CategoriaVenda_nome_key";
CREATE UNIQUE INDEX "CategoriaVenda_escopo_nome_key" ON "CategoriaVenda"("escopo", "nome");

-- Preserva os vínculos de complementos sem expor suas etiquetas no site.
-- Cadastros com PRINCIPAL permanecem produtos, inclusive como escolhas de grupos.
INSERT INTO "CategoriaVenda" ("id", "nome", "escopo", "cor", "ordem", "ativo", "versao")
SELECT 'catcmp_' || md5(c."id"), c."nome", 'COMPLEMENTO',
  (ARRAY['azul','verde','amarelo','vermelho'])[1 + (row_number() OVER (ORDER BY c."ordem", c."id") - 1)::int % 4],
  c."ordem", c."ativo", 1
FROM "CategoriaVenda" c
WHERE EXISTS (
  SELECT 1 FROM "ProdutoCategoriaVenda" pc JOIN "ProdutoVenda" p ON p."id" = pc."produtoId"
  WHERE pc."categoriaId" = c."id" AND NOT ('PRINCIPAL' = ANY(p."classificacoes"))
);
UPDATE "ProdutoCategoriaVenda" pc SET "categoriaId" = 'catcmp_' || md5(pc."categoriaId")
FROM "ProdutoVenda" p WHERE p."id" = pc."produtoId" AND NOT ('PRINCIPAL' = ANY(p."classificacoes"));
-- Recusa formulários abertos antes da troca de identidades de categorias.
UPDATE "ProdutoVenda" p SET "versao" = p."versao" + 1
WHERE EXISTS (SELECT 1 FROM "ProdutoCategoriaVenda" pc JOIN "CategoriaVenda" c ON c."id" = pc."categoriaId"
  WHERE pc."produtoId" = p."id" AND c."escopo" = 'COMPLEMENTO');
COMMIT;
