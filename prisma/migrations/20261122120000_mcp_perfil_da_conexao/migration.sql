-- Perfil de acesso próprio da conexão MCP, escolhido entre os perfis centrais do HUB,
-- com personalizações iguais às de um usuário. Aditiva: nenhuma linha é alterada.
-- Conexões existentes ficam com perfil nulo e continuam seguindo o responsável.
-- O acesso efetivo é sempre a interseção com as permissões atuais do responsável.
ALTER TABLE "McpAutorizacao" ADD COLUMN "perfilAcessoId" TEXT REFERENCES "PerfilAcesso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "McpAutorizacao" ADD COLUMN "permissoesPersonalizadas" JSONB NOT NULL DEFAULT '{}';
CREATE INDEX "McpAutorizacao_perfilAcessoId_idx" ON "McpAutorizacao"("perfilAcessoId");
