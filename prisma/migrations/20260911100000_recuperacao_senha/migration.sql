CREATE TABLE "RecuperacaoSenha" (
  "usuarioId" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "sessaoVersao" INTEGER NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "utilizadaEm" TIMESTAMP(3),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecuperacaoSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecuperacaoSenha_tokenHash_key" ON "RecuperacaoSenha"("tokenHash");
CREATE TABLE "LimiteAutenticacao" (
  "chave" TEXT NOT NULL PRIMARY KEY,
  "tentativas" INTEGER NOT NULL DEFAULT 1,
  "inicioEm" TIMESTAMP(3) NOT NULL,
  "ultimaEm" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "LimiteAutenticacao_inicioEm_idx" ON "LimiteAutenticacao"("inicioEm");
CREATE TABLE "ConfiguracaoEmail" (
  "id" TEXT NOT NULL DEFAULT 'singleton' PRIMARY KEY,
  "host" TEXT NOT NULL,
  "porta" INTEGER NOT NULL,
  "usuario" TEXT NOT NULL,
  "senhaCifrada" TEXT NOT NULL,
  "remetente" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
