-- Aditiva. Conservar perfis e vínculos históricos, congelar o teto legado antes
-- de retirar sua autoridade. Não mudar versão, cliente, callback ou credenciais.
ALTER TABLE "McpAutorizacao" ADD COLUMN "modeloAcesso" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "McpAutorizacao" ALTER COLUMN "perfilId" DROP NOT NULL;
UPDATE "McpAutorizacao" a SET "escopos" = ARRAY(
  SELECT s FROM unnest(a."escopos") s WHERE s = ANY(p."escopos")
), "situacao" = CASE WHEN p."ativo" THEN a."situacao" ELSE 'SUSPENSA' END
FROM "McpPerfil" p WHERE a."perfilId" = p."id";
UPDATE "McpAutorizacao" SET "modeloAcesso" = 2;
ALTER TABLE "McpAutorizacao" ALTER COLUMN "modeloAcesso" SET DEFAULT 2;
ALTER TABLE "McpEvento" ADD COLUMN "registros" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE "McpOperacao" (
  "id" TEXT NOT NULL, "autorizacaoId" TEXT NOT NULL, "usuarioId" TEXT NOT NULL,
  "ferramenta" TEXT NOT NULL, "chaveHash" TEXT NOT NULL, "conteudoHash" TEXT NOT NULL,
  "entrada" JSONB NOT NULL, "referencias" JSONB NOT NULL, "proposta" JSONB NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PREPARADA', "aprovadaEm" TIMESTAMP(3),
  "expiraEm" TIMESTAMP(3) NOT NULL, "resultado" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "McpOperacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "McpOperacao_autorizacao_fkey" FOREIGN KEY ("autorizacaoId") REFERENCES "McpAutorizacao"("id") ON DELETE RESTRICT,
  CONSTRAINT "McpOperacao_usuario_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "McpOperacao_autorizacaoId_ferramenta_chaveHash_key" ON "McpOperacao"("autorizacaoId", "ferramenta", "chaveHash");
CREATE INDEX "McpOperacao_usuarioId_estado_expiraEm_idx" ON "McpOperacao"("usuarioId", "estado", "expiraEm");
CREATE INDEX "McpOperacao_expiraEm_idx" ON "McpOperacao"("expiraEm");
