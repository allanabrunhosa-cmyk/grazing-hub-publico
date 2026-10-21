-- Aditiva. Nenhuma tabela financeira é alterada. O acesso nasce suspenso.
CREATE TABLE "McpConfiguracao" ("id" TEXT PRIMARY KEY DEFAULT 'singleton', "ativo" BOOLEAN NOT NULL DEFAULT false, "diagnostico" JSONB, "diagnosticadoEm" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "McpCliente" ("id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "redirectUris" TEXT[] NOT NULL, "ativo" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "McpPerfil" ("id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL UNIQUE, "descricao" TEXT NOT NULL, "escopos" TEXT[] NOT NULL, "ativo" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "McpAutorizacao" (
  "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
  "lojaId" TEXT NOT NULL DEFAULT 'singleton' REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT,
  "clienteId" TEXT NOT NULL REFERENCES "McpCliente"("id") ON DELETE RESTRICT,
  "perfilId" TEXT NOT NULL REFERENCES "McpPerfil"("id") ON DELETE RESTRICT,
  "escopos" TEXT[] NOT NULL, "restricoes" JSONB NOT NULL, "situacao" TEXT NOT NULL DEFAULT 'PREPARADA', "versao" INTEGER NOT NULL DEFAULT 0,
  "consentidaEm" TIMESTAMP(3), "ultimoUsoEm" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "McpAutorizacao_situacao_check" CHECK ("situacao" IN ('PREPARADA','ATIVA','SUSPENSA','REVOGADA')),
  CONSTRAINT "McpAutorizacao_loja_check" CHECK ("lojaId" = 'singleton')
);
CREATE INDEX "McpAutorizacao_usuarioId_clienteId_situacao_idx" ON "McpAutorizacao"("usuarioId","clienteId","situacao");
CREATE TABLE "McpSolicitacaoOAuth" ("id" TEXT PRIMARY KEY, "parametros" JSONB NOT NULL, "expiraEm" TIMESTAMP(3) NOT NULL, "consumidaEm" TIMESTAMP(3));
CREATE INDEX "McpSolicitacaoOAuth_expiraEm_idx" ON "McpSolicitacaoOAuth"("expiraEm");
CREATE TABLE "McpCodigoOAuth" (
  "hash" TEXT PRIMARY KEY, "autorizacaoId" TEXT NOT NULL REFERENCES "McpAutorizacao"("id") ON DELETE RESTRICT,
  "versao" INTEGER NOT NULL, "sessaoVersao" INTEGER NOT NULL, "redirectUri" TEXT NOT NULL, "challenge" TEXT NOT NULL,
  "escopos" TEXT[] NOT NULL, "restricoes" JSONB NOT NULL, "emissor" TEXT NOT NULL, "destinatario" TEXT NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL, "consumidoEm" TIMESTAMP(3)
);
CREATE INDEX "McpCodigoOAuth_expiraEm_idx" ON "McpCodigoOAuth"("expiraEm");
CREATE TABLE "McpToken" (
  "hash" TEXT PRIMARY KEY, "autorizacaoId" TEXT NOT NULL REFERENCES "McpAutorizacao"("id") ON DELETE RESTRICT,
  "versao" INTEGER NOT NULL, "sessaoVersao" INTEGER NOT NULL, "escopos" TEXT[] NOT NULL, "restricoes" JSONB NOT NULL,
  "emissor" TEXT NOT NULL, "destinatario" TEXT NOT NULL, "expiraEm" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "McpToken_expiraEm_idx" ON "McpToken"("expiraEm");
CREATE TABLE "McpEvento" ("id" TEXT PRIMARY KEY, "correlacao" TEXT NOT NULL, "usuarioId" TEXT, "clienteId" TEXT, "autorizacaoId" TEXT, "acao" TEXT NOT NULL, "ferramenta" TEXT, "resultado" TEXT NOT NULL, "duracaoMs" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "McpEvento_createdAt_idx" ON "McpEvento"("createdAt");
CREATE INDEX "McpEvento_autorizacaoId_createdAt_idx" ON "McpEvento"("autorizacaoId","createdAt");
CREATE TABLE "McpLimite" ("chave" TEXT PRIMARY KEY, "quantidade" INTEGER NOT NULL DEFAULT 1, "expiraEm" TIMESTAMP(3) NOT NULL);
CREATE INDEX "McpLimite_expiraEm_idx" ON "McpLimite"("expiraEm");
INSERT INTO "McpConfiguracao" ("id") VALUES ('singleton');
INSERT INTO "McpPerfil" ("id","nome","descricao","escopos") VALUES
  ('financeiro-gerencial','Financeiro gerencial','Somente resultados consolidados; não permite listar lançamentos.',ARRAY['financeiro:dre:ler','financeiro:fluxo:ler','financeiro:saldos:ler']),
  ('financeiro-detalhado','Financeiro detalhado','Resultados e registros financeiros, sempre limitados às permissões atuais do responsável.',ARRAY['financeiro:dre:ler','financeiro:fluxo:ler','financeiro:saldos:ler','financeiro:lancamentos:ler','financeiro:contas:ler','financeiro:plano:ler']);
