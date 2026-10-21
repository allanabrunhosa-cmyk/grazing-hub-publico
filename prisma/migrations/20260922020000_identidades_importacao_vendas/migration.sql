-- Identidade externa contextual: código PDV não é uma chave global.
-- O destino pode ser categoria, grupo, opção ou produto; sua existência é
-- conferida dentro da mesma transação de cadastro/importação.
CREATE TABLE "IdentidadeExternaVenda" (
 "id" TEXT PRIMARY KEY, "origem" TEXT NOT NULL, "loja" TEXT NOT NULL,
 "entidade" TEXT NOT NULL, "chave" TEXT NOT NULL, "destinoId" TEXT NOT NULL,
 "resumoOrigem" TEXT NOT NULL, "dadosOrigem" JSONB NOT NULL,
 "versaoDestino" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK ("entidade" IN ('CATEGORIA','GRUPO','OPCAO','PRODUTO'))
);
CREATE UNIQUE INDEX "IdentidadeExternaVenda_origem_loja_entidade_chave_key"
 ON "IdentidadeExternaVenda"("origem","loja","entidade","chave");
CREATE INDEX "IdentidadeExternaVenda_entidade_destinoId_idx"
 ON "IdentidadeExternaVenda"("entidade","destinoId");
