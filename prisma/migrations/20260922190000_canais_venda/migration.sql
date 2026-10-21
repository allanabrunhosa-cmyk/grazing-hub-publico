CREATE TABLE "CanalVenda" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CanalVenda_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CanalVenda_nome_key" ON "CanalVenda"("nome");
INSERT INTO "CanalVenda" ("id", "nome", "ordem")
SELECT 'canal-' || md5("canal"), "canal", row_number() OVER (ORDER BY "canal") - 1
FROM (SELECT DISTINCT "canal" FROM "PrecoProdutoVenda") AS canais;
