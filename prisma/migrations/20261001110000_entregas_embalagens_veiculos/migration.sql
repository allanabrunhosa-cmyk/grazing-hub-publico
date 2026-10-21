CREATE TABLE "TipoEmbalagemVenda" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TipoEmbalagemVenda_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TipoEmbalagemVenda_nome_tamanho" CHECK (char_length(trim("nome")) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX "TipoEmbalagemVenda_nome_normalizado" ON "TipoEmbalagemVenda" (upper(trim("nome")));
CREATE INDEX "TipoEmbalagemVenda_ativo_nome_idx" ON "TipoEmbalagemVenda" ("ativo", "nome");
ALTER TABLE "ProdutoVenda" ADD COLUMN "tipoEmbalagemId" TEXT;
ALTER TABLE "ProdutoVenda" ADD CONSTRAINT "ProdutoVenda_tipoEmbalagemId_fkey" FOREIGN KEY ("tipoEmbalagemId") REFERENCES "TipoEmbalagemVenda" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
