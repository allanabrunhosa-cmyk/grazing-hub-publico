ALTER TABLE "ProdutoVenda" ADD COLUMN "classificacoes" TEXT[] NOT NULL DEFAULT ARRAY['PRINCIPAL']::TEXT[];
UPDATE "ProdutoVenda" SET "classificacoes" = ARRAY["classificacao"];
ALTER TABLE "ProdutoVenda" ADD CONSTRAINT "ProdutoVenda_classificacoes_validas" CHECK (
  cardinality("classificacoes") BETWEEN 1 AND 3
  AND "classificacoes" <@ ARRAY['PRINCIPAL', 'OPCAO', 'COMPLEMENTO']::TEXT[]
);
ALTER TABLE "Insumo" ADD COLUMN "tempoPreparoMinutos" INTEGER;
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_tempoPreparoMinutos_valido" CHECK ("tempoPreparoMinutos" IS NULL OR "tempoPreparoMinutos" >= 0);

CREATE TABLE "CategoriaGrupoComplementoVenda" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "versao" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CategoriaGrupoComplementoVenda_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CategoriaGrupoComplementoVenda_nome_key" ON "CategoriaGrupoComplementoVenda"("nome");
ALTER TABLE "GrupoComplementoVenda" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "GrupoComplementoVenda" ADD CONSTRAINT "GrupoComplementoVenda_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGrupoComplementoVenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GrupoFiscalVenda" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "fiscal" JSONB NOT NULL DEFAULT '{}',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "versao" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "GrupoFiscalVenda_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrupoFiscalVenda_nome_key" ON "GrupoFiscalVenda"("nome");
ALTER TABLE "ProdutoVenda" ADD COLUMN "grupoFiscalId" TEXT;
ALTER TABLE "ProdutoVenda" ADD CONSTRAINT "ProdutoVenda_grupoFiscalId_fkey" FOREIGN KEY ("grupoFiscalId") REFERENCES "GrupoFiscalVenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
