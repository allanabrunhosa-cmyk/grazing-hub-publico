-- Somente estruturas novas; nenhuma alteração em estoque/financeiro/cadastros legados.
CREATE TABLE "FotoProdutoVenda" (
 "id" TEXT PRIMARY KEY, "dados" BYTEA NOT NULL, "mime" TEXT NOT NULL,
 "criadoPorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("mime" IN ('image/jpeg','image/png','image/webp')), CHECK (octet_length("dados") <= 2097152)
);
CREATE TABLE "ClienteVenda" (
 "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "tipo" TEXT NOT NULL DEFAULT 'PF',
 "documento" TEXT UNIQUE, "email" TEXT, "telefone" TEXT, "contato" TEXT, "observacoes" TEXT,
 "enderecos" JSONB NOT NULL DEFAULT '[]', "ativo" BOOLEAN NOT NULL DEFAULT true,
 "versao" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CHECK ("tipo" IN ('PF','PJ')),
 CHECK (jsonb_typeof("enderecos") = 'array')
);
CREATE INDEX "ClienteVenda_ativo_nome_idx" ON "ClienteVenda"("ativo","nome");
CREATE TABLE "CategoriaVenda" (
 "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL UNIQUE, "ordem" INTEGER NOT NULL DEFAULT 0,
 "ativo" BOOLEAN NOT NULL DEFAULT true, "versao" INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE "ProdutoVenda" (
 "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "especificacao" TEXT, "descricao" TEXT,
 "tipo" TEXT NOT NULL DEFAULT 'PADRAO', "codigo" TEXT UNIQUE, "unidade" TEXT NOT NULL DEFAULT 'UN',
 "fotoUrl" TEXT, "observacoes" TEXT, "modoPreparo" TEXT, "fiscal" JSONB NOT NULL DEFAULT '{}',
 "fiscalRevisado" BOOLEAN NOT NULL DEFAULT false, "ativo" BOOLEAN NOT NULL DEFAULT true,
 "versao" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CHECK ("tipo" IN ('PADRAO','PERSONALIZADO','REVENDA'))
);
CREATE INDEX "ProdutoVenda_ativo_nome_idx" ON "ProdutoVenda"("ativo","nome");
CREATE TABLE "ProdutoCategoriaVenda" (
 "produtoId" TEXT NOT NULL REFERENCES "ProdutoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "categoriaId" TEXT NOT NULL REFERENCES "CategoriaVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "ordem" INTEGER NOT NULL DEFAULT 0, PRIMARY KEY ("produtoId","categoriaId")
);
CREATE INDEX "ProdutoCategoriaVenda_categoriaId_ordem_idx" ON "ProdutoCategoriaVenda"("categoriaId","ordem");
CREATE TABLE "GrupoComplementoVenda" (
 "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL UNIQUE, "tipo" TEXT NOT NULL DEFAULT 'COMPOSICAO',
 "minimo" INTEGER NOT NULL DEFAULT 0, "maximo" INTEGER, "repetir" BOOLEAN NOT NULL DEFAULT true,
 "ativo" BOOLEAN NOT NULL DEFAULT true, "versao" INTEGER NOT NULL DEFAULT 1,
 CHECK ("tipo" IN ('COMPOSICAO','EXTRAS','COMPLEMENTAR')),
 CHECK ("minimo" >= 0 AND ("maximo" IS NULL OR "maximo" >= "minimo")),
 CHECK ("tipo" <> 'EXTRAS' OR ("minimo" = 0 AND "maximo" IS NULL AND "repetir" = true))
);
CREATE UNIQUE INDEX "GrupoComplementoVenda_extras_unico" ON "GrupoComplementoVenda"("tipo") WHERE "tipo" = 'EXTRAS';
CREATE TABLE "OpcaoComplementoVenda" (
 "id" TEXT PRIMARY KEY, "grupoId" TEXT NOT NULL REFERENCES "GrupoComplementoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "nome" TEXT NOT NULL, "preco" DECIMAL(12,2) NOT NULL DEFAULT 0,
 "produtoId" TEXT REFERENCES "ProdutoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantidade" NUMERIC NOT NULL DEFAULT 1, "ordem" INTEGER NOT NULL DEFAULT 0,
 "ativo" BOOLEAN NOT NULL DEFAULT true, CHECK ("preco" >= 0), CHECK ("quantidade" > 0)
);
CREATE INDEX "OpcaoComplementoVenda_grupoId_ordem_idx" ON "OpcaoComplementoVenda"("grupoId","ordem");
CREATE INDEX "OpcaoComplementoVenda_produtoId_idx" ON "OpcaoComplementoVenda"("produtoId");
CREATE TABLE "ProdutoGrupoVenda" (
 "produtoId" TEXT NOT NULL REFERENCES "ProdutoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "grupoId" TEXT NOT NULL REFERENCES "GrupoComplementoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "ordem" INTEGER NOT NULL DEFAULT 0, "usarPadrao" BOOLEAN NOT NULL DEFAULT true,
 "minimo" INTEGER NOT NULL DEFAULT 0, "maximo" INTEGER, PRIMARY KEY ("produtoId","grupoId"),
 CHECK ("minimo" >= 0 AND ("maximo" IS NULL OR "maximo" >= "minimo"))
);
CREATE INDEX "ProdutoGrupoVenda_grupoId_idx" ON "ProdutoGrupoVenda"("grupoId");
CREATE TABLE "PrecoProdutoVenda" (
 "produtoId" TEXT NOT NULL REFERENCES "ProdutoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "canal" TEXT NOT NULL, "preco" DECIMAL(12,2) NOT NULL, "ativo" BOOLEAN NOT NULL DEFAULT true,
 PRIMARY KEY ("produtoId","canal"), CHECK ("preco" >= 0)
);
CREATE TABLE "ComponenteProdutoVenda" (
 "id" TEXT PRIMARY KEY, "produtoId" TEXT NOT NULL REFERENCES "ProdutoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "insumoId" TEXT NOT NULL REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantidade" NUMERIC NOT NULL, "unidade" "UnidadeMedida" NOT NULL, "ordem" INTEGER NOT NULL DEFAULT 0,
 CHECK ("quantidade" > 0)
);
CREATE UNIQUE INDEX "ComponenteProdutoVenda_produtoId_insumoId_key" ON "ComponenteProdutoVenda"("produtoId","insumoId");
CREATE INDEX "ComponenteProdutoVenda_insumoId_idx" ON "ComponenteProdutoVenda"("insumoId");
CREATE TABLE "HistoricoCadastroVenda" (
 "id" TEXT PRIMARY KEY, "entidade" TEXT NOT NULL, "registroId" TEXT NOT NULL,
 "usuarioId" TEXT NOT NULL, "usuarioNome" TEXT NOT NULL, "antes" JSONB, "depois" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "HistoricoCadastroVenda_entidade_registroId_createdAt_idx" ON "HistoricoCadastroVenda"("entidade","registroId","createdAt");
-- Único grupo canônico de Extras. Opções são cadastradas/importadas explicitamente.
INSERT INTO "GrupoComplementoVenda" ("id","nome","tipo","minimo","maximo","repetir")
 VALUES ('vendas-extras-padrao','Extras','EXTRAS',0,NULL,true);
