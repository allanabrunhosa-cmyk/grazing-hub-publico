-- Qualquer alteração nas permissões financeiras do responsável exige consentimento
-- novo. O default vazio invalida com segurança eventuais credenciais anteriores.
ALTER TABLE "McpCodigoOAuth" ADD COLUMN "permissoesHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "McpToken" ADD COLUMN "permissoesHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "McpCodigoOAuth" ALTER COLUMN "permissoesHash" DROP DEFAULT;
ALTER TABLE "McpToken" ALTER COLUMN "permissoesHash" DROP DEFAULT;
